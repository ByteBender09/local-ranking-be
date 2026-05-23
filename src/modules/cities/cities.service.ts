import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { City } from '../../database/entities';

const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class CitiesService {
  constructor(
    @InjectRepository(City) private readonly cities: Repository<City>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findAll(): Promise<City[]> {
    const key = 'cities:all';
    const cached = await this.cache.get<City[]>(key);
    if (cached) return cached;
    const list = await this.cities.find({ order: { name: 'ASC' } });
    await this.cache.set(key, list, CACHE_TTL_MS);
    return list;
  }

  async findBySlug(slug: string): Promise<City> {
    const key = `cities:slug:${slug}`;
    const cached = await this.cache.get<City>(key);
    if (cached) return cached;
    const city = await this.cities.findOne({ where: { slug } });
    if (!city) throw new NotFoundException(`City not found: ${slug}`);
    await this.cache.set(key, city, CACHE_TTL_MS);
    return city;
  }
}
