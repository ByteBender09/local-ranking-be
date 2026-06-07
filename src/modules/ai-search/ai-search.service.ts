import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City, Venue } from '../../database/entities';
import { WardNormalizerService } from '../venues/ward-normalizer.service';
import { AiCacheService } from './ai-cache.service';
import { AiParserService } from './ai-parser.service';
import { AiRerankerService } from './ai-reranker.service';
import { bayesianScoreExpr } from '../venues/ranking';
import type { AiSearchResponse, ParsedIntent } from './types';

const DEFAULT_RESULT_COUNT = 12;
const MAX_RESULT_COUNT = 30;
const CANDIDATE_POOL_CAP = 120;

// Rerank now fires on EVERY query that has at least 3 candidates. The old
// behavior (only fire when vibe_tags / audience / timeOfDay was set)
// produced inconsistent UX — reasons appeared under some venue cards but
// not others depending on whether the parser picked up mood language.
// To keep cost flat with this change, the default reranker model dropped
// from claude-sonnet-4.5 to openai/gpt-4o-mini (set in config). Reasons
// are slightly more generic but the consistent presence is worth more
// than per-reason cleverness.

@Injectable()
export class AiSearchService {
  private readonly logger = new Logger(AiSearchService.name);

  constructor(
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(City) private readonly cities: Repository<City>,
    private readonly parser: AiParserService,
    private readonly reranker: AiRerankerService,
    private readonly cache: AiCacheService,
    private readonly wardNormalizer: WardNormalizerService,
  ) {}

  async search(
    rawQuery: string,
    opts: { currentCitySlug?: string } = {},
  ): Promise<AiSearchResponse> {
    const query = rawQuery.trim();
    if (!query) {
      return {
        query: '',
        intent: null,
        venues: [],
        intro: null,
        source: 'fresh',
      };
    }

    // Cache key intentionally does NOT include currentCitySlug — two
    // users searching "cafe chilling" from different cities should hit
    // separate cache entries. Compose it into the hash via a prefix.
    const cacheQuery = opts.currentCitySlug
      ? `[city:${opts.currentCitySlug}] ${query}`
      : query;

    const cached = await this.cache.get(cacheQuery);
    if (cached) {
      const topK = clampResultCount(cached.intent.resultCount);
      const firstPageIds = cached.venueIds.slice(0, topK);
      const venues = await this.hydrateByIds(firstPageIds);
      return {
        query,
        intent: cached.intent,
        venues,
        intro: cached.intro,
        source: 'cache',
        searchId: this.cache.key(cacheQuery),
        totalMatched: cached.venueIds.length,
      };
    }

    // ─── Cache miss → parser ──────────────────────────────────────
    const intent = await this.parser.parse(query);
    if (!intent) {
      return this.keywordFallback(query, 'parser_failed');
    }

    // Apply geo default: if parser didn't pin a city AND the FE told us
    // where the user is, scope to their current city. Without this, an
    // unscoped "cafe chilling" query searches all of Vietnam — usually
    // not what someone in HCM wants.
    if (intent.citySlugs.length === 0 && opts.currentCitySlug) {
      const exists = await this.cities.findOne({
        where: { slug: opts.currentCitySlug },
        select: { id: true },
      });
      if (exists) {
        intent.citySlugs = [opts.currentCitySlug];
      }
    }

    // Category-only fallback: user typed "tìm cafe" with no city.
    // Default to ho-chi-minh so we have a scope to search.
    if (intent.citySlugs.length === 0 && intent.categories.length > 0) {
      intent.citySlugs = ['ho-chi-minh'];
    }

    // ─── Simple-filter shortcut ───────────────────────────────────
    // A query that boils down to "city + optional category" is better
    // served by the city listing page (pagination, persistent filter)
    // than by the AI result list. Skip the reranker entirely.
    const shortcut = buildShortcutUrl(intent);
    if (shortcut) {
      return {
        query,
        intent,
        venues: [],
        intro: null,
        source: 'fresh',
        redirectTo: shortcut,
      };
    }

    // ─── Filter retrieval ─────────────────────────────────────────
    const candidates = await this.fetchByIntent(intent);
    if (candidates.length === 0) {
      // Don't waste an LLM rerank on an empty list. Still try the
      // keyword fallback in case the parser was over-restrictive.
      const fallback = await this.keywordFallback(query, 'no_candidates');
      // Preserve the intent so the UI still shows what was understood —
      // a "we got the filter right but DB has nothing" message is useful.
      return { ...fallback, intent };
    }

    // Rerank uses a smaller window (cost). The wider candidate pool is kept
    // around for pagination — user-visible "load more" reveals the rest in
    // filter order, no extra LLM cost.
    const topK = clampResultCount(intent.resultCount);
    const rerankWindow = candidates.slice(0, 30);

    let orderedIds: string[];
    let intro: string | null = null;
    let usedReranker = false;

    const rerankResult = await this.reranker.rerank(
      query,
      intent,
      rerankWindow,
      topK,
    );
    if (rerankResult) {
      const rerankedSet = new Set(rerankResult.orderedVenueIds);
      const tail = candidates
        .filter((c) => !rerankedSet.has(c.id))
        .map((c) => c.id);
      orderedIds = [...rerankResult.orderedVenueIds, ...tail];
      intro = rerankResult.intro;
      usedReranker = true;
    } else {
      orderedIds = candidates.map((v) => v.id);
    }

    // When user asked for an explicit count ("20 quán"), cap the pool to that
    // number — the FE then shows no "load more" past their target.
    if (intent.resultCount !== null && intent.resultCount > 0) {
      orderedIds = orderedIds.slice(
        0,
        Math.min(intent.resultCount, MAX_RESULT_COUNT * 4),
      );
    }

    await this.cache.set(cacheQuery, {
      intent,
      venueIds: orderedIds,
      intro,
      usedReranker,
    });

    const firstPageIds = orderedIds.slice(0, topK);
    const venues = await this.hydrateByIds(firstPageIds);
    return {
      query,
      intent,
      venues,
      intro,
      source: 'fresh',
      searchId: this.cache.key(cacheQuery),
      totalMatched: orderedIds.length,
    };
  }

  async more(
    rawQuery: string,
    opts: {
      currentCitySlug?: string;
      offset: number;
      limit: number;
    },
  ): Promise<{ venues: Venue[]; totalMatched: number }> {
    const query = rawQuery.trim();
    if (!query) return { venues: [], totalMatched: 0 };
    const cacheQuery = opts.currentCitySlug
      ? `[city:${opts.currentCitySlug}] ${query}`
      : query;
    const cached = await this.cache.get(cacheQuery);
    if (!cached) return { venues: [], totalMatched: 0 };
    const limit = Math.min(Math.max(opts.limit, 1), 24);
    const offset = Math.max(opts.offset, 0);
    const pageIds = cached.venueIds.slice(offset, offset + limit);
    const venues = await this.hydrateByIds(pageIds);
    return { venues, totalMatched: cached.venueIds.length };
  }

  // Filter against the venues table using whatever fields the parser
  // populated. Empty / null fields are no-ops — `intent` always parses
  // every field, the missing ones just don't add WHERE clauses.
  private async fetchByIntent(intent: ParsedIntent): Promise<Venue[]> {
    const qb = this.venues
      .createQueryBuilder('venue')
      .innerJoinAndSelect('venue.city', 'city')
      .where('venue.is_published = true');

    if (intent.citySlugs.length > 0) {
      qb.andWhere('city.slug IN (:...slugs)', { slugs: intent.citySlugs });
    } else if (intent.region) {
      qb.andWhere('city.region = :region', { region: intent.region });
    }

    if (intent.categories.length > 0) {
      qb.andWhere('venue.category IN (:...cats)', { cats: intent.categories });
    }

    if (intent.priceMax !== null) {
      qb.andWhere('venue.price_range <= :pmax', { pmax: intent.priceMax });
    }
    if (intent.priceMin !== null) {
      qb.andWhere('venue.price_range >= :pmin', { pmin: intent.priceMin });
    }
    if (intent.ratingMin !== null) {
      qb.andWhere('venue.rating >= :rmin', { rmin: intent.ratingMin });
    }

    // Ward expansion: "Quận 3" → ['Bàn Cờ', 'Xuân Hòa', 'Nhiêu Lộc']
    if (intent.wardQuery && intent.citySlugs.length === 1) {
      const expanded = this.wardNormalizer.expandQueryToWards(
        intent.citySlugs[0],
        intent.wardQuery,
      );
      if (expanded.length > 0) {
        qb.andWhere('venue.ward_canonical IN (:...wards)', { wards: expanded });
      }
    }

    // Cuisine / landmark: no structured column, fall back to LIKE on
    // name + tags + address. Cheap; would be replaced by FTS later.
    const looseTerms: string[] = [];
    if (intent.cuisine) looseTerms.push(intent.cuisine);
    if (intent.nearLandmark) looseTerms.push(intent.nearLandmark);
    looseTerms.forEach((term, i) => {
      const param = `loose${i}`;
      qb.andWhere(
        `(LOWER(venue.name) LIKE :${param}
          OR LOWER(venue.address) LIKE :${param}
          OR EXISTS (SELECT 1 FROM unnest(venue.tags) AS t WHERE LOWER(t) LIKE :${param}))`,
        { [param]: `%${term.toLowerCase()}%` },
      );
    });

    // Sort: parser gives a hint; default to Bayesian rating for "best"
    // feeling results. Bayesian guards against high-rating-low-reviews
    // venues bubbling to the top.
    switch (intent.sort) {
      case 'trending':
      case 'upvotes':
        qb.orderBy('venue.upvotes', 'DESC');
        break;
      case 'newest':
        qb.orderBy('venue.created_at', 'DESC');
        break;
      case 'rating':
        qb.orderBy(bayesianScoreExpr('venue'), 'DESC');
        break;
      default:
        // No explicit sort → trending feel by default. Reranker (if it
        // runs) will reorder this list anyway.
        qb.orderBy('venue.upvotes', 'DESC');
    }
    qb.addOrderBy('venue.id', 'ASC');

    qb.take(CANDIDATE_POOL_CAP);
    return qb.getMany();
  }

  // Re-fetch venues by id preserving the requested order. The orchestrator
  // stores ids in cache (not full rows) so that subsequent reads always
  // pick up the latest rating/upvotes/images without an invalidation pass.
  private async hydrateByIds(ids: string[]): Promise<Venue[]> {
    if (ids.length === 0) return [];
    const rows = await this.venues
      .createQueryBuilder('venue')
      .innerJoinAndSelect('venue.city', 'city')
      .where('venue.id IN (:...ids)', { ids })
      .andWhere('venue.is_published = true')
      .getMany();
    const byId = new Map(rows.map((v) => [v.id, v]));
    return ids.map((id) => byId.get(id)).filter((v): v is Venue => !!v);
  }

  // Final escape hatch: parser failed OR filter returned nothing. Run the
  // existing keyword search on the raw query so the user always gets SOME
  // result. `source: 'fallback'` lets the FE render an "AI offline" hint.
  private async keywordFallback(
    query: string,
    reason: string,
  ): Promise<AiSearchResponse> {
    this.logger.warn(`AI search fallback (${reason}) for query "${query}"`);
    const term = `%${query.toLowerCase()}%`;
    const venues = await this.venues
      .createQueryBuilder('venue')
      .innerJoinAndSelect('venue.city', 'city')
      .where('venue.is_published = true')
      .andWhere(
        `(LOWER(venue.name) LIKE :term
          OR LOWER(COALESCE(venue.ward_canonical, '')) LIKE :term
          OR LOWER(venue.district) LIKE :term
          OR LOWER(venue.address) LIKE :term)`,
        { term },
      )
      .orderBy('venue.upvotes', 'DESC')
      .limit(DEFAULT_RESULT_COUNT)
      .getMany();
    return {
      query,
      intent: null,
      venues,
      intro: null,
      source: 'fallback',
      fallbackReason: reason,
    };
  }
}

function clampResultCount(requested: number | null): number {
  if (requested === null || requested <= 0) return DEFAULT_RESULT_COUNT;
  return Math.min(requested, MAX_RESULT_COUNT);
}

// Returns the city-listing URL when the intent reduces to "one city +
// optional single category" with no AI-specific signals. Covers three
// shapes that don't benefit from the AI result list:
//   - "cafe Đà Lạt"  → /c/da-lat?category=cafe
//   - "Đà Lạt"       → /c/da-lat
//   - "đi đâu ở Đà Lạt" (discover / trip_plan no duration) → /c/da-lat
// A trip_plan WITH duration is an itinerary request — keep the AI path.
function buildShortcutUrl(intent: ParsedIntent): string | null {
  if (intent.intent === 'specific_venue') return null;
  if (intent.citySlugs.length !== 1) return null;
  if (intent.categories.length > 1) return null;
  if (intent.vibeTags.length > 0) return null;
  if (intent.audience !== null) return null;
  if (intent.timeOfDay !== null) return null;
  if (intent.cuisine !== null) return null;
  if (intent.nearLandmark !== null) return null;
  if (intent.wardQuery !== null) return null;
  if (intent.priceMax !== null) return null;
  if (intent.priceMin !== null) return null;
  if (intent.ratingMin !== null) return null;
  if (intent.durationDays !== null && intent.durationDays > 0) return null;

  const params = new URLSearchParams();
  if (intent.categories.length === 1) params.set('category', intent.categories[0]);
  const qs = params.toString();
  return qs
    ? `/c/${intent.citySlugs[0]}?${qs}`
    : `/c/${intent.citySlugs[0]}`;
}
