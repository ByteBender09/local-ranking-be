import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { City, Venue } from '../../database/entities';
import {
  CreateAdminVenueDto,
  UpdateAdminVenueDto,
} from './dto/admin-venue.dto';
import {
  AdminVenueSort,
  ListAdminVenuesDto,
} from './dto/list-admin-venues.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { CitiesService } from '../cities/cities.service';
import { WardNormalizerService } from '../venues/ward-normalizer.service';

// Normalise a user-entered website into a stored value: trim, drop when empty,
// and prepend https:// when the scheme is missing so the FE always gets a
// clickable absolute URL. Returns null to clear the column.
function normalizeWebsite(input: string | undefined): string | null {
  if (input === undefined) return null;
  const v = input.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  return withScheme.slice(0, 500);
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);

@Injectable()
export class AdminCitiesVenuesService {
  constructor(
    @InjectRepository(City) private readonly cities: Repository<City>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    private readonly citiesService: CitiesService,
    private readonly wardNormalizer: WardNormalizerService,
  ) {}

  // Re-resolve ward_canonical from district + address. Called on create
  // and on every update that changes district / address / cityId — those
  // are the only inputs the normalizer reads, so unrelated edits don't
  // pay the lookup cost.
  private async resolveWardFor(venue: Venue): Promise<void> {
    const city = await this.cities.findOne({
      where: { id: venue.cityId },
      select: { slug: true },
    });
    if (!city) return;
    const result = this.wardNormalizer.resolve({
      citySlug: city.slug,
      rawDistrict: venue.district,
    });
    if (result) {
      venue.wardCanonical = result.wardCanonical;
      venue.wardType = result.wardType;
      venue.wardResolutionMethod = result.method;
    } else {
      venue.wardCanonical = null;
      venue.wardType = null;
      venue.wardResolutionMethod = null;
    }
  }

  // CITIES ----------------------------------------------------------

  listCities(): Promise<City[]> {
    return this.cities.find({ order: { name: 'ASC' } });
  }

  async getCity(slug: string): Promise<City> {
    const city = await this.cities.findOne({ where: { slug } });
    if (!city) throw new NotFoundException('City not found');
    return city;
  }

  async updateCity(slug: string, dto: UpdateCityDto): Promise<City> {
    const city = await this.getCity(slug);
    if (dto.name !== undefined) city.name = dto.name;
    if (dto.nameEn !== undefined) city.nameEn = dto.nameEn;
    if (dto.region !== undefined) city.region = dto.region;
    if (dto.coverImage !== undefined) city.coverImage = dto.coverImage;
    if (dto.tagline !== undefined) city.tagline = dto.tagline;
    if (dto.description !== undefined) city.description = dto.description;
    if (dto.highlights !== undefined) city.highlights = dto.highlights;
    if (dto.lat !== undefined) city.lat = dto.lat;
    if (dto.lng !== undefined) city.lng = dto.lng;
    const saved = await this.cities.save(city);
    await this.citiesService.invalidateBySlug(slug);
    return saved;
  }

  // VENUES ----------------------------------------------------------

  listVenuesByCity(citySlug: string): Promise<Venue[]> {
    return this.venues
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.city', 'c')
      .where('c.slug = :citySlug', { citySlug })
      .orderBy('v.is_published', 'DESC')
      .addOrderBy('v.upvotes', 'DESC')
      .getMany();
  }

  async listVenuesPaged(
    filter: ListAdminVenuesDto,
  ): Promise<PaginatedResponse<Venue>> {
    const qb = this.venues
      .createQueryBuilder('venue')
      .innerJoinAndSelect('venue.city', 'city');

    if (filter.citySlug)
      qb.andWhere('city.slug = :citySlug', { citySlug: filter.citySlug });
    if (filter.category)
      qb.andWhere('venue.category = :category', { category: filter.category });
    if (filter.isPublished !== undefined) {
      qb.andWhere('venue.is_published = :pub', {
        pub: filter.isPublished === 'true',
      });
    }
    if (filter.q && filter.q.trim()) {
      const term = `%${filter.q.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(venue.name) LIKE :term
          OR LOWER(venue.district) LIKE :term
          OR LOWER(COALESCE(venue.ward_canonical, '')) LIKE :term
          OR LOWER(venue.address) LIKE :term
          OR LOWER(venue.slug) LIKE :term)`,
        { term },
      );
    }

    this.applyAdminSort(qb, filter.sort);
    qb.addOrderBy('venue.id', 'ASC').skip(filter.skip).take(filter.limit);

    const [items, total] = await qb.getManyAndCount();
    return new PaginatedResponse(items, total, filter.page, filter.limit);
  }

  private applyAdminSort(
    qb: ReturnType<Repository<Venue>['createQueryBuilder']>,
    sort: AdminVenueSort,
  ): void {
    switch (sort) {
      case 'oldest':
        qb.orderBy('venue.createdAt', 'ASC');
        return;
      case 'upvotes':
        qb.orderBy('venue.upvotes', 'DESC');
        return;
      case 'name':
        qb.orderBy('venue.name', 'ASC');
        return;
      case 'newest':
      default:
        qb.orderBy('venue.createdAt', 'DESC');
        return;
    }
  }

  async getVenue(slug: string): Promise<Venue> {
    const v = await this.venues.findOne({
      where: { slug },
      relations: { city: true },
    });
    if (!v) throw new NotFoundException('Venue not found');
    return v;
  }

  async createVenue(dto: CreateAdminVenueDto): Promise<Venue> {
    const city = await this.cities.findOne({ where: { id: dto.cityId } });
    if (!city) throw new BadRequestException('City does not exist');

    const baseSlug = `${slugify(dto.name)}-${city.slug}`;
    const slug = await this.uniqueSlug(baseSlug);

    const venue = this.venues.create({
      slug,
      name: dto.name,
      category: dto.category,
      cityId: city.id,
      district: dto.district,
      address: dto.address,
      description: dto.description,
      website: normalizeWebsite(dto.website),
      images: dto.images,
      tags: dto.tags,
      hours: dto.hours,
      priceRange: dto.priceRange,
      lat: dto.lat,
      lng: dto.lng,
      isPublished: dto.isPublished ?? true,
      rating: 0,
      reviewCount: 0,
      upvotes: 0,
    });
    await this.resolveWardFor(venue);
    const saved = await this.venues.save(venue);
    // venueCount changed for this city — bust the listing cache.
    await this.citiesService.invalidateBySlug(city.slug);
    return saved;
  }

  async updateVenue(slug: string, dto: UpdateAdminVenueDto): Promise<Venue> {
    const venue = await this.getVenue(slug);
    if (dto.cityId !== undefined) {
      const city = await this.cities.findOne({ where: { id: dto.cityId } });
      if (!city) throw new BadRequestException('City does not exist');
      venue.cityId = city.id;
    }
    if (dto.name !== undefined) venue.name = dto.name;
    if (dto.category !== undefined) venue.category = dto.category;
    if (dto.district !== undefined) venue.district = dto.district;
    if (dto.address !== undefined) venue.address = dto.address;
    if (dto.description !== undefined) venue.description = dto.description;
    if (dto.website !== undefined) venue.website = normalizeWebsite(dto.website);
    if (dto.images !== undefined) venue.images = dto.images;
    if (dto.tags !== undefined) venue.tags = dto.tags;
    if (dto.hours !== undefined) venue.hours = dto.hours;
    if (dto.priceRange !== undefined) venue.priceRange = dto.priceRange;
    if (dto.lat !== undefined) venue.lat = dto.lat;
    if (dto.lng !== undefined) venue.lng = dto.lng;
    if (dto.isPublished !== undefined) venue.isPublished = dto.isPublished;
    // Re-resolve ward whenever any input the normalizer reads has changed.
    // Currently that's just `district`, but if we ever feed the address
    // into normalization at this layer too, extend the condition.
    if (dto.district !== undefined || dto.cityId !== undefined) {
      await this.resolveWardFor(venue);
    }
    const saved = await this.venues.save(venue);
    await this.invalidateForVenue(saved);
    return saved;
  }

  async deleteVenue(slug: string): Promise<void> {
    const venue = await this.getVenue(slug);
    await this.venues.delete({ id: venue.id });
    await this.invalidateForVenue(venue);
  }

  async setPublished(slug: string, isPublished: boolean): Promise<Venue> {
    const venue = await this.getVenue(slug);
    venue.isPublished = isPublished;
    const saved = await this.venues.save(venue);
    await this.invalidateForVenue(saved);
    return saved;
  }

  private async invalidateForVenue(venue: Venue): Promise<void> {
    if (venue.city?.slug) {
      await this.citiesService.invalidateBySlug(venue.city.slug);
      return;
    }
    // Fall back to invalidating the whole list when we don't have a slug.
    await this.citiesService.invalidateAll();
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let i = 1;
    while (await this.venues.exists({ where: { slug: candidate } })) {
      i += 1;
      candidate = `${base}-${i}`;
    }
    return candidate;
  }
}
