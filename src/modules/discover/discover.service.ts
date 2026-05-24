import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { CheckIn, Vote, Venue } from '../../database/entities';

const CACHE_TTL_MS = 60 * 1000;

@Injectable()
export class DiscoverService {
  constructor(
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(CheckIn) private readonly checkIns: Repository<CheckIn>,
    @InjectRepository(Vote) private readonly votes: Repository<Vote>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async trending(limit = 8): Promise<Venue[]> {
    return this.cached(`discover:trending:${limit}`, () =>
      this.venues
        .createQueryBuilder('v')
        .innerJoinAndSelect('v.city', 'c')
        .where('v.is_published = true')
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
        .where('v.is_published = true')
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
        .where('v.is_published = true')
        .andWhere('v.rating >= :min', { min: 4.7 })
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
        .where('v.is_published = true')
        .andWhere('v.rating >= :rating', { rating: 4.6 })
        .andWhere('v.upvotes < :ceiling', { ceiling: 800 })
        .orderBy('v.rating', 'DESC')
        .limit(limit)
        .getMany(),
    );
  }

  // Personalised recommendations based on the user's check-in history.
  //
  // Algorithm (no ML — purely deterministic + a sprinkle of randomness):
  //   1. Gather every venue the user has ever checked in. These are their
  //      "ground truth" preferences (places they actually visited).
  //   2. Build category + city affinity scores: each visited venue adds
  //      weight to its category (+2) and city (+1). Upvoted check-ins
  //      (positive Vote) add an extra +1 to category.
  //   3. Score candidate venues = (rating) + (category affinity) +
  //      (0.5 × city affinity) + small jitter for variety.
  //   4. EXCLUDE all venues the user already checked in.
  //   5. Return top N. Falls back to editor's pick if no check-ins yet.
  async recommendForUser(userId: string, limit = 8): Promise<Venue[]> {
    const userCheckIns = await this.checkIns.find({
      where: { userId },
      relations: { venue: true },
    });
    if (userCheckIns.length === 0) return this.editorsPick(limit);

    const visitedIds = userCheckIns
      .map((c) => c.venueId)
      .filter((id): id is string => Boolean(id));

    // Build affinity maps from the check-in history.
    const categoryWeight = new Map<string, number>();
    const cityWeight = new Map<string, number>();
    for (const ci of userCheckIns) {
      if (!ci.venue) continue;
      categoryWeight.set(
        ci.venue.category,
        (categoryWeight.get(ci.venue.category) ?? 0) + 2,
      );
      cityWeight.set(
        ci.venue.cityId,
        (cityWeight.get(ci.venue.cityId) ?? 0) + 1,
      );
    }

    // Upvotes on those check-ins amplify category affinity — the user
    // didn't just visit, they liked it enough to vote +1.
    const upvotes = await this.votes.find({
      where: { userId, value: 1 },
      relations: { venue: true },
    });
    for (const v of upvotes) {
      if (!v.venue) continue;
      categoryWeight.set(
        v.venue.category,
        (categoryWeight.get(v.venue.category) ?? 0) + 1,
      );
    }

    // Pull a broad candidate pool, excluding venues the user already
    // visited. Pulling 6× the limit keeps variety after re-ranking.
    const qb = this.venues
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.city', 'c')
      .where('v.is_published = true');
    if (visitedIds.length > 0) {
      qb.andWhere('v.id NOT IN (:...visitedIds)', { visitedIds });
    }
    const candidates = await qb
      .orderBy('v.rating', 'DESC')
      .limit(limit * 6)
      .getMany();

    if (candidates.length === 0) return [];

    const scored = candidates.map((v) => {
      const catScore = categoryWeight.get(v.category) ?? 0;
      const cityScore = cityWeight.get(v.cityId) ?? 0;
      // Jitter ensures two equally-good venues don't always appear in the
      // same order — keeps the feed feeling fresh on each visit.
      const jitter = Math.random() * 0.6;
      return {
        v,
        score: Number(v.rating) + catScore + cityScore * 0.5 + jitter,
      };
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
