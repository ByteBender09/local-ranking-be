import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import {
  City,
  Tour,
  TourPromotion,
  User,
  Venue,
} from '../../database/entities';
import {
  CreateTourDto,
  UpdateTourDto,
  UpsertPromotionDto,
} from './dto/tour-management.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);

@Injectable()
export class TourManagementService {
  constructor(
    @InjectRepository(Tour) private readonly tours: Repository<Tour>,
    @InjectRepository(City) private readonly cities: Repository<City>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  listMine(ownerId: string): Promise<Tour[]> {
    return this.tours.find({
      where: { ownerId },
      relations: { city: true },
      order: { createdAt: 'DESC' },
    });
  }

  async create(actor: AuthenticatedUser, dto: CreateTourDto): Promise<Tour> {
    const city = await this.cities.findOne({ where: { id: dto.cityId } });
    if (!city) throw new NotFoundException('City not found');

    if (dto.venueIds?.length) {
      await this.assertVenuesExist(dto.venueIds);
    }

    const owner = await this.users.findOneOrFail({ where: { id: actor.id } });

    // Branding gate: business owners must have brand name + short name set up
    // before publishing tours. Admins bypass (they may seed catalog tours).
    if (owner.role !== 'admin') {
      if (!owner.brandName || !owner.brandShortName) {
        throw new BadRequestException(
          'BRANDING_REQUIRED: Hãy hoàn tất thương hiệu trước khi tạo tour',
        );
      }
    }

    const slug = await this.uniqueSlug(`${slugify(dto.title)}-${city.slug}`);

    const images = dto.images ?? [];
    // Cover precedence: explicit dto.image > first uploaded image > brand logo.
    const cover = dto.image ?? images[0] ?? owner.brandLogoUrl ?? '';

    const tour = this.tours.create({
      slug,
      title: dto.title,
      cityId: city.id,
      category: dto.category,
      durationHours: dto.durationHours,
      priceVnd: dto.priceVnd,
      image: cover,
      images,
      description: dto.description ?? '',
      bookingUrl: dto.bookingUrl ?? null,
      highlights: dto.highlights ?? [],
      venueIds: dto.venueIds ?? [],
      promotions: [],
      rating: 0,
      reviewCount: 0,
      ownerId: owner.id,
      provider: this.buildProvider(owner),
      isPublished: true,
    });
    return this.tours.save(tour);
  }

  private buildProvider(owner: User): {
    name: string;
    shortName: string;
    verified: boolean;
    logoUrl: string | null;
  } {
    return {
      name: owner.brandName ?? owner.name,
      shortName:
        owner.brandShortName ?? owner.handle.slice(0, 6).toUpperCase(),
      verified: owner.role === 'admin' ? true : owner.brandEmailVerified,
      logoUrl: owner.brandLogoUrl ?? null,
    };
  }

  async update(
    actor: AuthenticatedUser,
    tourId: string,
    dto: UpdateTourDto,
  ): Promise<Tour> {
    const tour = await this.ownedTour(actor, tourId);

    if (dto.venueIds?.length) {
      await this.assertVenuesExist(dto.venueIds);
    }

    if (dto.cityId !== undefined) {
      const city = await this.cities.findOne({ where: { id: dto.cityId } });
      if (!city) throw new NotFoundException('City not found');
      tour.cityId = city.id;
    }
    if (dto.title !== undefined) tour.title = dto.title;
    if (dto.category !== undefined) tour.category = dto.category;
    if (dto.durationHours !== undefined) tour.durationHours = dto.durationHours;
    if (dto.priceVnd !== undefined) tour.priceVnd = dto.priceVnd;
    if (dto.images !== undefined) {
      tour.images = dto.images;
      // Keep cover in sync with the gallery unless the caller explicitly
      // overrides it in the same request.
      if (dto.image === undefined) tour.image = dto.images[0] ?? tour.image;
    }
    if (dto.image !== undefined) tour.image = dto.image;
    if (dto.description !== undefined) tour.description = dto.description;
    if (dto.bookingUrl !== undefined) tour.bookingUrl = dto.bookingUrl;
    if (dto.highlights !== undefined) tour.highlights = dto.highlights;
    if (dto.venueIds !== undefined) tour.venueIds = dto.venueIds;
    if (dto.isPublished !== undefined) tour.isPublished = dto.isPublished;

    return this.tours.save(tour);
  }

  async remove(actor: AuthenticatedUser, tourId: string): Promise<void> {
    const tour = await this.ownedTour(actor, tourId);
    await this.tours.delete({ id: tour.id });
  }

  async addPromotion(
    actor: AuthenticatedUser,
    tourId: string,
    dto: UpsertPromotionDto,
  ): Promise<TourPromotion> {
    const tour = await this.ownedTour(actor, tourId);
    if (tour.promotions.length >= 20) {
      throw new BadRequestException('Too many promotions');
    }
    const promo: TourPromotion = { id: randomUUID(), ...dto };
    tour.promotions = [...tour.promotions, promo];
    await this.tours.save(tour);
    return promo;
  }

  async updatePromotion(
    actor: AuthenticatedUser,
    tourId: string,
    promotionId: string,
    dto: UpsertPromotionDto,
  ): Promise<TourPromotion> {
    const tour = await this.ownedTour(actor, tourId);
    const idx = tour.promotions.findIndex((p) => p.id === promotionId);
    if (idx < 0) throw new NotFoundException('Promotion not found');
    const next: TourPromotion = { ...tour.promotions[idx], ...dto, id: promotionId };
    tour.promotions = tour.promotions.map((p, i) => (i === idx ? next : p));
    await this.tours.save(tour);
    return next;
  }

  async removePromotion(
    actor: AuthenticatedUser,
    tourId: string,
    promotionId: string,
  ): Promise<void> {
    const tour = await this.ownedTour(actor, tourId);
    tour.promotions = tour.promotions.filter((p) => p.id !== promotionId);
    await this.tours.save(tour);
  }

  private async ownedTour(actor: AuthenticatedUser, tourId: string): Promise<Tour> {
    const tour = await this.tours.findOne({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');
    if (actor.role !== 'admin' && tour.ownerId !== actor.id) {
      throw new ForbiddenException('Not your tour');
    }
    return tour;
  }

  private async assertVenuesExist(ids: string[]): Promise<void> {
    const found = await this.venues.count({ where: { id: In(ids) } });
    if (found !== ids.length) {
      throw new BadRequestException('One or more venueIds are invalid');
    }
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let i = 1;
    while (await this.tours.exists({ where: { slug: candidate } })) {
      i += 1;
      candidate = `${base}-${i}`;
    }
    return candidate;
  }
}
