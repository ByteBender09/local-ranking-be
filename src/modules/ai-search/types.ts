import type { Category } from '../../database/entities';

// Shape returned by the LLM parser. Mirrors the tool-call schema in
// ai-parser.service.ts exactly so type errors at compile time surface any
// schema/code drift. Every field has a defined "empty" value (null / []
// / false) so downstream consumers never need to defensively check undefined.
export interface ParsedIntent {
  intent: 'search' | 'trip_plan' | 'specific_venue' | 'discover';
  citySlugs: string[];
  wardQuery: string | null;
  region: 'north' | 'central' | 'south' | null;
  nearLandmark: string | null;
  categories: Category[];
  cuisine: string | null;
  priceMax: 1 | 2 | 3 | 4 | null;
  ratingMin: number | null;
  openNow: boolean;
  vibeTags: string[];
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | null;
  audience: 'couple' | 'family' | 'solo' | 'group' | null;
  resultCount: number | null;
  sort: 'upvotes' | 'rating' | 'newest' | 'trending' | null;
  durationDays: number | null;
  ambiguousTerms: string[];
  // Language the user wrote the query in. Detected by the parser so the
  // reranker can return reasons in the matching language ("Vietnamese
  // reasons for a Vietnamese query, English for an English query"). Other
  // languages (Korean tourist in Đà Nẵng, etc.) fall through to 'en'.
  language: 'vi' | 'en';
}

// Final response from POST /ai/search consumed by the FE. `source` lets
// the FE distinguish cache hits (instant) from fresh LLM calls (1-3s) and
// `fallback` flags when the AI pipeline errored and we returned plain
// keyword-search results so the FE can render an "AI offline" hint.
export interface AiSearchResponse {
  query: string;
  intent: ParsedIntent | null;
  venues: unknown[];
  intro: string | null;
  source: 'cache' | 'fresh' | 'fallback';
  fallbackReason?: string;
  // When set, FE should navigate here instead of rendering AI results.
  // Used when the query is a pure city + category filter — the city
  // listing page gives a better UX (pagination, persistent filter)
  // than the AI result list for that shape.
  redirectTo?: string;
}
