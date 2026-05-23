import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { In, Repository } from 'typeorm';
import { JourneyEntry, Venue } from '../../database/entities';

const CACHE_TTL_MS = 60 * 1000;

@Injectable()
export class DiscoverService {
  constructor(
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(JourneyEntry) private readonly journey: Repository<JourneyEntry>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async trending(limit = 8): Promise<Venue[]> {
    return this.cached(`discover:trending:${limit}`, () =>
      this.venues
        .createQueryBuilder('v')
        .innerJoinAndSelect('v.city', 'c')
        .orderBy('v.upvotes', 'DESC')
        .limit(limit)
        .getMany(),
    );
  }

  async recentlyLiked(limit = 8): Promise<Venue[]> {
    return this.cached(`discover:recently-liked:${limit}`, () =>
      this.venues
        .createQueryBuilder('v')
        .innerJoinAndSelect('v.city', 'c')
        .orderBy('v.updated_at', 'DESC')
        .limit(limit)
        .getMany(),
    );
  }

  async editorsPick(limit = 8): Promise<Venue[]> {
    return this.cached(`discover:editors-pick:${limit}`, () =>
      this.venues
        .createQueryBuilder('v')
        .innerJoinAndSelect('v.city', 'c')
        .where('v.rating >= :min', { min: 4.7 })
        .orderBy('v.rating', 'DESC')
        .limit(limit)
        .getMany(),
    );
  }

  async hiddenGems(limit = 8): Promise<Venue[]> {
    return this.cached(`discover:hidden-gems:${limit}`, () =>
      this.venues
        .createQueryBuilder('v')
        .innerJoinAndSelect('v.city', 'c')
        .where('v.rating >= :rating', { rating: 4.6 })
        .andWhere('v.upvotes < :ceiling', { ceiling: 800 })
        .orderBy('v.rating', 'DESC')
        .limit(limit)
        .getMany(),
    );
  }

  async recommendForUser(userId: string, limit = 8): Promise<Venue[]> {
    const ownEntries = await this.journey.find({
      where: { userId },
      select: { venueId: true },
    });
    if (ownEntries.length === 0) return this.editorsPick(limit);

    const venueIds = ownEntries.map((e) => e.venueId);
    const journeyVenues = await this.venues.find({
      where: { id: In(venueIds) },
      select: { id: true, cityId: true, category: true },
    });

    const cities = Array.from(new Set(journeyVenues.map((v) => v.cityId)));
    const categories = new Set(journeyVenues.map((v) => v.category));

    const candidates = await this.venues
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.city', 'c')
      .where('v.id NOT IN (:...ids)', { ids: venueIds })
      .orderBy('v.rating', 'DESC')
      .limit(limit * 5)
      .getMany();

    const scored = candidates.map((v) => {
      let score = Number(v.rating);
      if (cities.includes(v.cityId)) score += 3;
      if (!categories.has(v.category)) score += 2;
      return { v, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.v);
  }

  private async cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit) return hit;
    const fresh = await loader();
    await this.cache.set(key, fresh, CACHE_TTL_MS);
    return fresh;
  }
}
