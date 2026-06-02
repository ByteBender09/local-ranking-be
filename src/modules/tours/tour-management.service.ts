import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import {
  Brand,
  City,
  Tour,
  TourPromotion,
  TourScope,
  TourStop,
  Venue,
} from '../../database/entities';
import {
  CreateTourDto,
  TourStopDto,
  UpdateTourDto,
  UpsertPromotionDto,
} from './dto/tour-management.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

// Provider stamped on system-managed tours (no brand owner).
const SITE_PROVIDER = {
  name: 'Hôm Nay Đi Đâu',
  shortName: 'HNDD',
  verified: true,
  logoUrl: null as string | null,
};

// Resolved itinerary: validated stops plus the fields derived from them that
// live denormalised on the tour row.
interface ResolvedItinerary {
  stops: TourStop[];
  primaryCityId: string;
  venueIds: string[];
  scope: TourScope;
}

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
    @InjectRepository(TourStop)
    private readonly tourStops: Repository<TourStop>,
    @InjectRepository(City) private readonly cities: Repository<City>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(Brand) private readonly brands: Repository<Brand>,
  ) {}

  // Admin-only management: list every tour (newest first) with its itinerary
  // and brand for the admin tour table.
  listAll(): Promise<Tour[]> {
    return this.tours.find({
      relations: { city: true, brand: true, stops: { city: true, venue: true } },
      order: { createdAt: 'DESC' },
    });
  }

  // Validate an ordered list of stop DTOs and compute the fields that live
  // denormalised on the tour (primary city, venue ids, scope). Throws if any
  // city/venue is missing or a venue doesn't belong to its stop's city.
  private async resolveItinerary(
    stopDtos: TourStopDto[],
  ): Promise<ResolvedItinerary> {
    const cityIds = [...new Set(stopDtos.map((s) => s.cityId))];
    const cities = await this.cities.find({ where: { id: In(cityIds) } });
    if (cities.length !== cityIds.length) {
      throw new BadRequestException('One or more stop cities are invalid');
    }

    const venueIds = stopDtos
      .map((s) => s.venueId)
      .filter((id): id is string => Boolean(id));
    const venuesById = new Map<string, Venue>();
    if (venueIds.length) {
      const venues = await this.venues.find({
        where: { id: In([...new Set(venueIds)]) },
      });
      for (const v of venues) venuesById.set(v.id, v);
      for (const s of stopDtos) {
        if (!s.venueId) continue;
        const v = venuesById.get(s.venueId);
        if (!v) throw new BadRequestException(`Invalid venueId: ${s.venueId}`);
        if (v.cityId !== s.cityId) {
          throw new BadRequestException(
            `Venue ${s.venueId} does not belong to the stop's city`,
          );
        }
      }
    }

    const stops = stopDtos.map((s, i) =>
      this.tourStops.create({
        order: i,
        cityId: s.cityId,
        venueId: s.venueId ?? null,
      }),
    );

    // De-duplicated venue ids in stop order — what `tour.venueIds` exposes.
    const orderedVenueIds = [
      ...new Set(
        stopDtos
          .map((s) => s.venueId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    return {
      stops,
      primaryCityId: stopDtos[0].cityId,
      venueIds: orderedVenueIds,
      scope: cityIds.length > 1 ? 'inter_province' : 'intra_city',
    };
  }

  // Resolve the providing brand. Omitted/empty ⇒ system tour (null).
  private async resolveBrand(brandId?: string): Promise<Brand | null> {
    if (!brandId) return null;
    const brand = await this.brands.findOne({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(actor: AuthenticatedUser, dto: CreateTourDto): Promise<Tour> {
    void actor; // management is admin-only (enforced by the controller guard)
    const itinerary = await this.resolveItinerary(dto.stops);
    const brand = await this.resolveBrand(dto.brandId);

    const primaryCity = await this.cities.findOneOrFail({
      where: { id: itinerary.primaryCityId },
    });
    const slug = await this.uniqueSlug(
      `${slugify(dto.title)}-${primaryCity.slug}`,
    );

    const images = dto.images ?? [];
    // Cover precedence: explicit dto.image > first uploaded image > brand logo.
    const cover = dto.image ?? images[0] ?? brand?.logoUrl ?? '';

    const tour = this.tours.create({
      slug,
      title: dto.title,
      cityId: itinerary.primaryCityId,
      scope: itinerary.scope,
      stops: itinerary.stops,
      category: dto.category,
      durationHours: dto.durationHours,
      priceVnd: dto.priceVnd,
      image: cover,
      images,
      description: dto.description ?? '',
      bookingUrl: dto.bookingUrl ?? null,
      highlights: dto.highlights ?? [],
      venueIds: itinerary.venueIds,
      promotions: [],
      rating: 0,
      reviewCount: 0,
      brandId: brand?.id ?? null,
      ownerId: null,
      provider: this.buildProvider(brand),
      isPublished: true,
    });
    // cascade: true on Tour.stops persists the stops in the same save.
    return this.tours.save(tour);
  }

  private buildProvider(brand: Brand | null): {
    name: string;
    shortName: string;
    verified: boolean;
    logoUrl: string | null;
  } {
    if (!brand) return { ...SITE_PROVIDER };
    return {
      name: brand.name,
      shortName: brand.shortName,
      verified: brand.verified,
      logoUrl: brand.logoUrl ?? null,
    };
  }

  async update(
    actor: AuthenticatedUser,
    tourId: string,
    dto: UpdateTourDto,
  ): Promise<Tour> {
    void actor; // management is admin-only (enforced by the controller guard)
    const tour = await this.getTour(tourId);

    // Reassign the providing brand — re-stamp the denormalised provider so
    // cards show the new brand.
    if (dto.brandId !== undefined) {
      const brand = await this.resolveBrand(dto.brandId);
      tour.brandId = brand?.id ?? null;
      tour.provider = this.buildProvider(brand);
    }

    // Replace the itinerary: re-derive city/venues/scope and swap the stops.
    if (dto.stops !== undefined) {
      const itinerary = await this.resolveItinerary(dto.stops);
      await this.tourStops.delete({ tourId: tour.id });
      tour.stops = itinerary.stops;
      tour.cityId = itinerary.primaryCityId;
      tour.venueIds = itinerary.venueIds;
      tour.scope = itinerary.scope;
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
    if (dto.isPublished !== undefined) tour.isPublished = dto.isPublished;

    return this.tours.save(tour);
  }

  async remove(actor: AuthenticatedUser, tourId: string): Promise<void> {
    void actor; // admin-only management — no per-owner check
    const tour = await this.getTour(tourId);
    await this.tours.delete({ id: tour.id });
  }

  async addPromotion(
    actor: AuthenticatedUser,
    tourId: string,
    dto: UpsertPromotionDto,
  ): Promise<TourPromotion> {
    void actor; // admin-only management — no per-owner check
    const tour = await this.getTour(tourId);
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
    void actor; // admin-only management — no per-owner check
    const tour = await this.getTour(tourId);
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
    void actor; // admin-only management — no per-owner check
    const tour = await this.getTour(tourId);
    tour.promotions = tour.promotions.filter((p) => p.id !== promotionId);
    await this.tours.save(tour);
  }

  private async getTour(tourId: string): Promise<Tour> {
    const tour = await this.tours.findOne({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');
    return tour;
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
