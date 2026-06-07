import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { In, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { CheckIn, SavedVenue, Vote, Venue } from '../../database/entities';
import { bayesianScoreExpr } from '../venues/ranking';

const CACHE_TTL_MS = 5 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class DiscoverService {
  constructor(
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(CheckIn) private readonly checkIns: Repository<CheckIn>,
    @InjectRepository(Vote) private readonly votes: Repository<Vote>,
    @InjectRepository(SavedVenue) private readonly saved: Repository<SavedVenue>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // "Đang hot trong tuần" — venues ranked by the rise in upvotes over the last
  // 7 days (rolling window over Vote.createdAt). No reset job needed: the window
  // slides forward continuously. Falls back to all-time upvotes when a fresh
  // week hasn't produced enough signal yet.
  async trending(limit = 8, citySlug?: string): Promise<Venue[]> {
    return this.cached(`discover:trending:${limit}:${citySlug ?? 'all'}`, async () => {
      const since = new Date(Date.now() - WEEK_MS);
      const qb = this.votes
        .createQueryBuilder('vote')
        .innerJoin(
          'venues',
          'v',
          'v.id = vote.venue_id AND v.is_published = true',
        )
        .select('vote.venue_id', 'venueId')
        .addSelect('COUNT(*)', 'cnt')
        .where('vote.value = 1')
        .andWhere('vote.created_at >= :since', { since });
      this.scopeToCity(qb, citySlug);
      const ranked = await qb
        .groupBy('vote.venue_id')
        .orderBy('cnt', 'DESC')
        .limit(limit)
        .getRawMany<{ venueId: string }>();

      const ids = await this.fillWithTopUpvotes(
        ranked.map((r) => r.venueId),
        limit,
        citySlug,
      );
      return this.fetchVenuesInOrder(ids);
    });
  }

  // "Cộng đồng đang ưa thích" — venues ranked by how many users favorited
  // (saved) them over the last 30 days (rolling window over SavedVenue.addedAt).
  // Favoriting requires no prior check-in. Saved rows are wiped monthly, so this
  // naturally reflects the current month's enthusiasm.
  async communityFavorites(limit = 8, citySlug?: string): Promise<Venue[]> {
    return this.cached(
      `discover:community-favorites:${limit}:${citySlug ?? 'all'}`,
      async () => {
        const since = new Date(Date.now() - MONTH_MS);
        const qb = this.saved
          .createQueryBuilder('s')
          .innerJoin(
            'venues',
            'v',
            'v.id = s.venue_id AND v.is_published = true',
          )
          .select('s.venue_id', 'venueId')
          .addSelect('COUNT(*)', 'cnt')
          .where('s.added_at >= :since', { since });
        this.scopeToCity(qb, citySlug);
        const ranked = await qb
          .groupBy('s.venue_id')
          .orderBy('cnt', 'DESC')
          .limit(limit)
          .getRawMany<{ venueId: string }>();

        const ids = await this.fillWithTopUpvotes(
          ranked.map((r) => r.venueId),
          limit,
          citySlug,
        );
        return this.fetchVenuesInOrder(ids);
      },
    );
  }

  // Backward-compatible alias. The old "recently liked" section now maps to the
  // community-favorites ranking so existing clients keep working.
  recentlyLiked(limit = 8, citySlug?: string): Promise<Venue[]> {
    return this.communityFavorites(limit, citySlug);
  }

  async editorsPick(limit = 8, citySlug?: string): Promise<Venue[]> {
    return this.cached(`discover:editors-pick:${limit}:${citySlug ?? 'all'}`, () => {
      const qb = this.venues
        .createQueryBuilder('v')
        .innerJoinAndSelect('v.city', 'c')
        .where('v.is_published = true')
        .andWhere('v.rating >= :min', { min: 4.7 });
      if (citySlug) qb.andWhere('c.slug = :citySlug', { citySlug });
      return (
        qb
          // Rank by Bayesian weighted rating so well-reviewed 4.7★ venues beat
          // thin-sample 4.9★ ones. See venues/ranking.ts.
          .orderBy(bayesianScoreExpr('v'), 'DESC')
          .addOrderBy('v.review_count', 'DESC')
          .limit(limit)
          .getMany()
      );
    });
  }

  async hiddenGems(limit = 8, citySlug?: string): Promise<Venue[]> {
    return this.cached(`discover:hidden-gems:${limit}:${citySlug ?? 'all'}`, () => {
      const qb = this.venues
        .createQueryBuilder('v')
        .innerJoinAndSelect('v.city', 'c')
        .where('v.is_published = true')
        .andWhere('v.rating >= :rating', { rating: 4.6 })
        .andWhere('v.upvotes < :ceiling', { ceiling: 800 })
        // A "hidden gem" must still be trustworthy: require a minimum review
        // volume so we surface genuinely-loved lesser-known spots, not noise
        // from a couple of reviews. Then rank by Bayesian weighted rating.
        .andWhere('v.review_count >= :minReviews', { minReviews: 30 });
      if (citySlug) qb.andWhere('c.slug = :citySlug', { citySlug });
      return qb
        .orderBy(bayesianScoreExpr('v'), 'DESC')
        .limit(limit)
        .getMany();
    });
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

    const visitedIds = [
      ...new Set(
        userCheckIns
          .map((c) => c.venueId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    // Build affinity maps from the check-in history.
    const categoryWeight = new Map<string, number>();
    const cityWeight = new Map<string, number>();
    for (const ci of userCheckIns) {
      if (!ci.venue) continue;
      categoryWeight.set(
        ci.venue.category,
        (categoryWeight.get(ci.venue.category) ?? 0) + 2,
      );
      cityWeight.set(ci.venue.cityId, (cityWeight.get(ci.venue.cityId) ?? 0) + 1);
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

  // Top up a ranked id list with the all-time most-upvoted published venues so
  // a section is never empty / short when a rolling window is sparse.
  private async fillWithTopUpvotes(
    ids: string[],
    limit: number,
    citySlug?: string,
  ): Promise<string[]> {
    if (ids.length >= limit) return ids;
    const qb = this.venues
      .createQueryBuilder('v')
      .select('v.id', 'id')
      .where('v.is_published = true');
    if (citySlug) {
      qb.innerJoin('v.city', 'c').andWhere('c.slug = :citySlug', { citySlug });
    }
    if (ids.length > 0) {
      qb.andWhere('v.id NOT IN (:...ids)', { ids });
    }
    const extra = await qb
      .orderBy('v.upvotes', 'DESC')
      .addOrderBy('v.rating', 'DESC')
      .limit(limit - ids.length)
      .getRawMany<{ id: string }>();
    return [...ids, ...extra.map((e) => e.id)];
  }

  // Constrain a vote/saved aggregation query to a single city (by slug) by
  // joining the cities table off the already-joined `v` (venues) alias. No-op
  // when no city is given — the feed stays global (overall) as a fallback.
  private scopeToCity<T extends SelectQueryBuilder<ObjectLiteral>>(
    qb: T,
    citySlug?: string,
  ): T {
    if (citySlug) {
      qb.innerJoin('cities', 'c', 'c.id = v.city_id').andWhere(
        'c.slug = :citySlug',
        { citySlug },
      );
    }
    return qb;
  }

  // Load venues (with city) for the given ids, preserving the id order.
  private async fetchVenuesInOrder(ids: string[]): Promise<Venue[]> {
    if (ids.length === 0) return [];
    const venues = await this.venues.find({
      where: { id: In(ids), isPublished: true },
      relations: { city: true },
    });
    const order = new Map(ids.map((id, i) => [id, i]));
    return venues.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
  }

  private async cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit) return hit;
    const fresh = await loader();
    await this.cache.set(key, fresh, CACHE_TTL_MS);
    return fresh;
  }
}
