import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { City, Venue } from '../../database/entities';

const CACHE_TTL_MS = 5 * 60 * 1000;

export type CityWithCount = City & { venueCount: number };

@Injectable()
export class CitiesService {
  constructor(
    @InjectRepository(City) private readonly cities: Repository<City>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // List all cities with the count of *published* venues per city. The count
  // is computed by a single grouped query so we never N+1.
  async findAll(): Promise<CityWithCount[]> {
    const key = 'cities:all';
    const cached = await this.cache.get<CityWithCount[]>(key);
    if (cached) return cached;

    const list = await this.cities.find({ order: { name: 'ASC' } });
    const counts = await this.venues
      .createQueryBuilder('v')
      .select('v.city_id', 'cityId')
      .addSelect('COUNT(*)', 'count')
      .where('v.is_published = true')
      .groupBy('v.city_id')
      .getRawMany<{ cityId: string; count: string }>();
    const byCity = new Map(counts.map((c) => [c.cityId, parseInt(c.count, 10)]));

    const enriched = list.map((c) => ({
      ...c,
      venueCount: byCity.get(c.id) ?? 0,
    }));
    await this.cache.set(key, enriched, CACHE_TTL_MS);
    return enriched;
  }

  async findBySlug(slug: string): Promise<CityWithCount> {
    const key = `cities:slug:${slug}`;
    const cached = await this.cache.get<CityWithCount>(key);
    if (cached) return cached;

    const city = await this.cities.findOne({ where: { slug } });
    if (!city) throw new NotFoundException(`City not found: ${slug}`);
    const count = await this.venues
      .createQueryBuilder('v')
      .where('v.city_id = :id', { id: city.id })
      .andWhere('v.is_published = true')
      .getCount();
    const enriched = { ...city, venueCount: count };
    await this.cache.set(key, enriched, CACHE_TTL_MS);
    return enriched;
  }

  // Called by AdminCitiesVenuesService after any mutation that affects the
  // public city listing (city edit, venue create / publish / delete).
  async invalidateAll(): Promise<void> {
    await this.cache.del('cities:all');
  }

  async invalidateBySlug(slug: string): Promise<void> {
    await this.cache.del(`cities:slug:${slug}`);
    await this.cache.del('cities:all');
  }
}
