import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { DataSource, EntityManager } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { City, Venue, User, Review, Ward } from './entities';
import type { Category } from './entities';
import {
  resolveWardFromVenue,
  toNormalizable,
  type NormalizableWard,
  type ResolveResult,
} from '../modules/venues/ward-resolver';
import { buildExternalRaw } from './piso-to-external-raw';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// PISO Maps DISCOVERY importer — gap-fill mode.
//
// Unlike import-pisomap.ts which iterates a hand-curated seed list, this script
// asks PISO "give me <category> in <city>" with several keyword variants,
// filters the results by quality, and imports up to --count passing places.
//
// Quality filters (defaults — override via flags):
//   - external rating > --min-rating          (default 4.0)
//   - external reviews > --min-reviews        (default 100)
//   - downloadable images >= --min-images     (default 5)
//   - skip entirely if image candidates <2    (--skip-if-images-lt, default 2)
//
// Idempotent: existing slug OR external_id skipped. Per-run progress file +
// per-run log file so each invocation has its own audit trail.
//
// USAGE
//   npx ts-node src/database/import-pisomap-discover.ts \
//     --city=da-lat --category=viewpoint --count=15
//
//   # custom thresholds
//   npx ts-node src/database/import-pisomap-discover.ts \
//     --city=ho-chi-minh --category=bar --count=10 \
//     --min-rating=4.3 --min-reviews=200 --min-images=6
//
//   # dry-run (no DB writes, no image uploads, just shows what would import)
//   npx ts-node src/database/import-pisomap-discover.ts \
//     --city=ha-noi --category=bar --count=5 --dry-run
//
// ENV  PISOMAP_API_KEY, BACKEND_PUBLIC_URL, IMPORT_ADMIN_JWT, DATABASE_URL
// ─────────────────────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const FLAGS = {
  city: arg('city', ''),
  category: arg('category', '') as Category | '',
  count: parseInt(arg('count', '10'), 10),
  // STRICT defaults — venues that don't pass are rejected outright. NEVER
  // fall back to the Unsplash image pool: a venue with no real photos has
  // no business being in the user-facing dataset.
  //   rating  > 4.0   (default)
  //   reviews > 200   (default — was 100; bumped after fake-image audit)
  //   images >= 5     (default; counted AFTER successful CDN upload)
  //   skipped if image candidates returned by Piso < 2
  minRating: parseFloat(arg('min-rating', '4.0')),
  minReviews: parseInt(arg('min-reviews', '200'), 10),
  minImages: parseInt(arg('min-images', '5'), 10),
  skipIfImagesLt: parseInt(arg('skip-if-images-lt', '2'), 10),
  photos: parseInt(arg('photos', '5'), 10),
  reviews: parseInt(arg('reviews', '4'), 10),
  uploadDelay: parseInt(arg('upload-delay', '300'), 10),
  apiDelay: parseInt(arg('api-delay', '500'), 10),
  cacheTtlDays: parseInt(arg('cache-ttl-days', '30'), 10),
  noCache: process.argv.includes('--no-cache'),
  dryRun: process.argv.includes('--dry-run'),
};

// ── PISO response cache ──────────────────────────────────────────────────────
// File-based JSON cache shared across runs. Re-running the same city+category
// query against PISO costs the same API quota — caching the search responses
// (50-100 candidates per category) and place details means a follow-up run
// that only needs to import +5 more venues doesn't re-pay the discovery cost.
//
// Layout:
//   import-pisomap-cache/search/<sha1(query+lat+lng)>.json
//   import-pisomap-cache/place/<data_id>.json
//
// Entries past `--cache-ttl-days` are ignored (still on disk, just re-fetched).
// Pass `--no-cache` to bypass the cache entirely (always fresh).
const CACHE_DIR = resolve(process.cwd(), 'import-pisomap-cache');
const CACHE_SEARCH_DIR = resolve(CACHE_DIR, 'search');
const CACHE_PLACE_DIR = resolve(CACHE_DIR, 'place');

function ensureCacheDirs(): void {
  if (FLAGS.noCache) return;
  for (const d of [CACHE_DIR, CACHE_SEARCH_DIR, CACHE_PLACE_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

function cacheKey(parts: (string | number)[]): string {
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}

function readCache<T>(file: string): T | null {
  if (FLAGS.noCache) return null;
  if (!existsSync(file)) return null;
  try {
    const ageMs = Date.now() - statSync(file).mtimeMs;
    if (ageMs > FLAGS.cacheTtlDays * 86400 * 1000) return null;
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch { return null; }
}

function writeCache<T>(file: string, value: T): void {
  if (FLAGS.noCache) return;
  try { writeFileSync(file, JSON.stringify(value)); } catch { /* best-effort */ }
}

const cacheStats = { searchHit: 0, searchMiss: 0, placeHit: 0, placeMiss: 0 };

const VALID_CATEGORIES: Category[] = [
  'cafe', 'restaurant', 'street_food', 'viewpoint', 'beach',
  'homestay', 'bar', 'museum', 'park', 'shopping',
];

// Search keywords per category. Multiple queries widen the funnel — PISO
// typically returns ~15-20 results per query so 3-5 keywords yield 50-100
// candidates after dedupe.
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  cafe: ['cafe', 'quán cà phê', 'specialty coffee', 'rooftop cafe', 'cafe sân vườn'],
  restaurant: ['nhà hàng', 'restaurant', 'fine dining', 'nhà hàng Việt', 'nhà hàng hải sản'],
  street_food: ['quán ăn vặt', 'street food', 'ẩm thực đường phố', 'quán ăn ngon', 'bánh tráng nướng'],
  viewpoint: ['điểm ngắm cảnh', 'view đẹp', 'thắng cảnh', 'núi', 'thác nước', 'đồi', 'hồ'],
  beach: ['bãi biển', 'beach', 'bãi tắm'],
  homestay: ['homestay', 'boutique homestay', 'guesthouse', 'hostel'],
  bar: ['bar', 'quán bar', 'cocktail bar', 'rooftop bar', 'craft beer', 'pub', 'club'],
  museum: ['bảo tàng', 'museum', 'di tích', 'đền chùa', 'nhà thờ'],
  park: ['công viên', 'park', 'vườn quốc gia', 'khu sinh thái'],
  shopping: ['chợ', 'shopping mall', 'trung tâm thương mại', 'siêu thị', 'cửa hàng lưu niệm'],
};

const API_KEY = process.env.PISOMAP_API_KEY ?? '';
const API_BASE = 'https://api.pisomap.tech/api/maps';
const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const ADMIN_JWT = process.env.IMPORT_ADMIN_JWT ?? '';

const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const PROGRESS_FILE = resolve(
  process.cwd(),
  `import-pisomap-discover-${FLAGS.city}-${FLAGS.category}.json`,
);
const LOG_FILE = resolve(
  process.cwd(),
  `import-pisomap-discover-${FLAGS.city}-${FLAGS.category}-${RUN_ID}.log`,
);

// Tee log line to both stdout and the run-specific log file. Every state
// transition during a crawl writes here so you can post-mortem a partial run.
function log(line: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  const stamped = `[${ts}] ${line}`;
  console.log(stamped);
  try { appendFileSync(LOG_FILE, stamped + '\n'); } catch { /* no-op */ }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slugify = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function haversineKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371, d = Math.PI / 180;
  const dla = (la2 - la1) * d, dlo = (lo2 - lo1) * d;
  const x = Math.sin(dla / 2) ** 2 +
    Math.cos(la1 * d) * Math.cos(la2 * d) * Math.sin(dlo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function seedRandom(slug: string, max: number, min = 50): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return min + (h % (max - min));
}

async function withRetry<T>(fn: () => Promise<T>, label: string, tries = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const s = axios.isAxiosError(e) ? e.response?.status : undefined;
      if (s && s < 500 && s !== 429) break;
      await sleep(s === 429 ? 15000 : 1000 * (i + 1));
    }
  }
  throw new Error(`${label} failed: ${String(last)}`);
}

interface PisoSearchItem {
  data_id?: string; place_id?: string; title?: string; type?: string;
  rating?: number; reviews?: number;
  location?: { latitude?: number; longitude?: number; address?: { full?: string } };
  opening_hours?: { day: string; hours: string }[];
  contacts?: { phone?: string; website?: string };
}
interface PisoMedia { id?: string; url?: string; width?: number; height?: number }
interface PisoReview {
  review_id?: string; author_name?: string; author_profile_pic?: string;
  rating?: number; relative_date?: string; text?: string; photos?: PisoMedia[];
}
interface PisoPlace extends PisoSearchItem {
  description?: string;
  photos?: { category_id?: string; media?: PisoMedia[] }[];
  review_list?: PisoReview[];
  google_maps_url?: string;
}

async function apiSearch(q: string, lat: number, lng: number): Promise<PisoSearchItem[]> {
  const key = cacheKey([q, lat.toFixed(4), lng.toFixed(4)]);
  const file = resolve(CACHE_SEARCH_DIR, `${key}.json`);
  const cached = readCache<PisoSearchItem[]>(file);
  if (cached) {
    cacheStats.searchHit++;
    return cached;
  }
  cacheStats.searchMiss++;
  const r = await withRetry(
    () => axios.get<{ local_result?: PisoSearchItem[] }>(`${API_BASE}/search`, {
      params: { q, lat, lng }, headers: { 'x-api-key': API_KEY }, timeout: 30000,
    }), 'search');
  const items = r.data?.local_result ?? [];
  writeCache(file, items);
  return items;
}

async function apiPlace(dataId: string, lat: number, lng: number): Promise<PisoPlace | null> {
  const file = resolve(CACHE_PLACE_DIR, `${dataId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  const cached = readCache<PisoPlace>(file);
  if (cached) {
    cacheStats.placeHit++;
    return cached;
  }
  cacheStats.placeMiss++;
  const r = await withRetry(
    () => axios.get<{ place_result?: PisoPlace }>(`${API_BASE}/place`, {
      params: { data_id: dataId, lat, lng }, headers: { 'x-api-key': API_KEY }, timeout: 30000,
    }), 'place');
  const place = r.data?.place_result ?? null;
  if (place) writeCache(file, place);
  return place;
}

function flatMedia(p: PisoPlace): string[] {
  const urls: string[] = [];
  for (const g of p.photos ?? []) for (const m of g.media ?? []) if (m.url) urls.push(m.url);
  return urls;
}

function compactHours(oh?: { day: string; hours: string }[]): string {
  if (!oh || oh.length === 0) return '';
  const h = oh[0].hours ?? '';
  const m = h.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
  if (m) return `${m[1]} - ${m[2]}`.slice(0, 64);
  if (/24|cả ngày/i.test(h)) return '24/7';
  return '';
}

async function uploadImage(url: string): Promise<string> {
  const img = await withRetry(
    () => axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 30000 }),
    'download image', 3);
  const webp = await sharp(Buffer.from(img.data))
    .resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const up = await withRetry(() => {
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array(webp)], { type: 'image/webp' }), 'g.webp');
    return axios.post<{ data?: { url?: string }; url?: string }>(`${BACKEND}/admin/uploads`, fd, {
      headers: { Authorization: `Bearer ${ADMIN_JWT}` }, maxBodyLength: Infinity, timeout: 30000,
    });
  }, 'upload', 6);
  const out = up.data?.data?.url ?? up.data?.url;
  if (!out) throw new Error('upload returned no url');
  return out;
}

async function getOrCreateReviewer(
  m: EntityManager, authorName: string, avatar: string, cache: Map<string, string>,
): Promise<string> {
  const clean = (authorName || 'Khách Google').trim().slice(0, 60);
  const handle = ('g-' + slugify(clean)).slice(0, 40) || 'g-khach';
  if (cache.has(handle)) return cache.get(handle)!;
  let user = await m.findOne(User, { where: { handle } });
  if (!user) {
    user = await m.save(m.create(User, {
      handle, name: clean, role: 'user', isSynthetic: true,
      avatar: avatar || `https://picsum.photos/seed/${handle}/200/200`,
      bio: '', socials: {}, bookingEnabled: false,
      checkInCount: 0, followerCount: 0,
    }));
  }
  cache.set(handle, user.id);
  return user.id;
}

function blend(extRating: number, extCount: number, localAvg: number, localCount: number) {
  const combinedCount = localCount + extCount;
  const rating = combinedCount > 0
    ? (localAvg * localCount + extRating * extCount) / combinedCount : 0;
  return { rating: Math.round(rating * 100) / 100, reviewCount: combinedCount };
}

type Progress = Record<string, string>;
const loadProgress = (): Progress =>
  existsSync(PROGRESS_FILE) ? JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')) : {};
const saveProgress = (p: Progress) => writeFileSync(PROGRESS_FILE, JSON.stringify(p));

async function main(): Promise<void> {
  if (!API_KEY) throw new Error('PISOMAP_API_KEY required');
  if (!FLAGS.dryRun && (!BACKEND || !ADMIN_JWT))
    throw new Error('BACKEND_PUBLIC_URL + IMPORT_ADMIN_JWT required (unless --dry-run)');
  if (!FLAGS.city) throw new Error('--city=<slug> required');
  if (!FLAGS.category || !VALID_CATEGORIES.includes(FLAGS.category))
    throw new Error(`--category=<one of ${VALID_CATEGORIES.join('|')}> required`);
  if (FLAGS.count <= 0) throw new Error('--count must be > 0');

  ensureCacheDirs();
  log(`▶ START ${FLAGS.dryRun ? '(dry-run) ' : ''}city=${FLAGS.city} category=${FLAGS.category} count=${FLAGS.count}`);
  log(`  filters: rating>${FLAGS.minRating}, reviews>${FLAGS.minReviews}, images>=${FLAGS.minImages}, skipIfImgsLt=${FLAGS.skipIfImagesLt}`);
  log(`  cache: ${FLAGS.noCache ? 'DISABLED' : `${CACHE_DIR} (TTL ${FLAGS.cacheTtlDays}d)`}`);
  log(`  log file: ${LOG_FILE}`);

  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const cityRepo = ds.getRepository(City);
  const venueRepo = ds.getRepository(Venue);

  const city = await cityRepo.findOne({ where: { slug: FLAGS.city } });
  if (!city) throw new Error(`city "${FLAGS.city}" not found`);
  if (city.lat == null || city.lng == null) {
    throw new Error(`city "${FLAGS.city}" missing lat/lng — required for distance filter`);
  }
  const cityLat: number = city.lat;
  const cityLng: number = city.lng;
  log(`  city center: ${cityLat},${cityLng}`);

  // Load wards for this city once. Each venue we insert resolves its
  // canonical post-2025 ward at write time so the row lands in DB with
  // ward_canonical / ward_type / ward_resolution_method already populated
  // — no follow-up backfill needed.
  const wardEntities = await ds.getRepository(Ward).find({
    where: { city: { id: city.id } },
  });
  const cityWards: NormalizableWard[] = toNormalizable(wardEntities.map((w) => ({
    name: w.name,
    type: w.type as 'phuong' | 'xa' | 'dac_khu',
    aliasesOldDistrict: w.aliasesOldDistrict ?? [],
    aliasesOldWards: w.aliasesOldWards ?? [],
    aliasesUser: w.aliasesUser ?? [],
  })));
  log(`  loaded ${cityWards.length} canonical wards for ${FLAGS.city}`);
  let wardResolvedCount = 0;
  let wardUnresolvedCount = 0;

  const keywords = CATEGORY_KEYWORDS[FLAGS.category as Category];
  const progress = loadProgress();
  const reviewerCache = new Map<string, string>();

  // PHASE 1 — discovery: run all keyword searches, dedupe by data_id.
  const candidates = new Map<string, PisoSearchItem>();
  for (const kw of keywords) {
    const q = `${kw} ${city.name}`;
    const hitsBefore = cacheStats.searchHit;
    log(`  🔍 search "${q}"`);
    try {
      const results = await apiSearch(q, cityLat, cityLng);
      const fromCache = cacheStats.searchHit > hitsBefore;
      log(`     ← ${results.length} results ${fromCache ? '(cache)' : '(api)'}`);
      for (const r of results) {
        if (!r.data_id || !r.title) continue;
        // Cluster around city — drop venues > 120km from center (Phú Quốc / Cần Giờ / Lạc Dương still pass).
        const la = r.location?.latitude, lo = r.location?.longitude;
        if (typeof la === 'number' && typeof lo === 'number') {
          if (haversineKm(cityLat, cityLng, la, lo) > 120) continue;
        }
        if (!candidates.has(r.data_id)) candidates.set(r.data_id, r);
      }
      // Only throttle when we actually hit the network. Cache hits are free.
      if (!fromCache) await sleep(FLAGS.apiDelay);
    } catch (e) {
      log(`     ✗ search failed: ${String(e)}`);
      await sleep(FLAGS.apiDelay);
    }
  }
  log(`▶ DISCOVERY done. ${candidates.size} unique candidates (search cache: ${cacheStats.searchHit} hit / ${cacheStats.searchMiss} miss)`);

  // PHASE 2 — quality filter on search-level fields (rating / reviews) before
  // making expensive place-detail calls.
  const passRating: PisoSearchItem[] = [];
  let droppedRating = 0, droppedReviews = 0, droppedDup = 0;
  for (const c of candidates.values()) {
    if ((c.rating ?? 0) <= FLAGS.minRating) { droppedRating++; continue; }
    if ((c.reviews ?? 0) <= FLAGS.minReviews) { droppedReviews++; continue; }
    // Dedupe against existing venues by externalId (cheap query).
    const dup = await venueRepo.findOne({
      where: { externalId: c.data_id! },
      withDeleted: true,
      select: { id: true },
    });
    if (dup) { droppedDup++; continue; }
    passRating.push(c);
  }
  // Sort by rating*log(reviews) — highest signal first.
  passRating.sort((a, b) => {
    const sa = (a.rating ?? 0) * Math.log10((a.reviews ?? 0) + 1);
    const sb = (b.rating ?? 0) * Math.log10((b.reviews ?? 0) + 1);
    return sb - sa;
  });
  log(`▶ FILTER (rating/reviews/dup): ${passRating.length} passed, ${droppedRating} dropped by rating, ${droppedReviews} by reviews, ${droppedDup} existing`);

  if (passRating.length === 0) {
    log('⚠ no candidates passed the rating/reviews filter — relax thresholds or pick another keyword set');
    await ds.destroy();
    return;
  }

  // PHASE 3 — fetch place detail, check image count, import.
  let imported = 0, skippedNoImg = 0, skippedTooFew = 0, failed = 0;
  for (const c of passRating) {
    if (imported >= FLAGS.count) {
      log(`✓ reached --count=${FLAGS.count} — stopping`);
      break;
    }
    const name = c.title!;
    const slug = `${slugify(name)}-${FLAGS.city}`;
    if (progress[slug] === 'saved' || progress[slug] === 'skipped') {
      log(`  ⤷ already processed: ${name}`);
      continue;
    }
    const existsBySlug = await venueRepo.findOne({ where: { slug }, withDeleted: true, select: { id: true } });
    if (existsBySlug) {
      progress[slug] = 'skipped'; saveProgress(progress);
      log(`  ⤷ slug exists: ${name}`);
      continue;
    }

    log(`  ▶ ${name} (${c.rating}★ / ${c.reviews} reviews)`);
    try {
      const lat = c.location?.latitude ?? cityLat;
      const lng = c.location?.longitude ?? cityLng;
      const hitsBefore = cacheStats.placeHit;
      const place = await apiPlace(c.data_id!, lat, lng);
      const placeFromCache = cacheStats.placeHit > hitsBefore;
      if (!placeFromCache) await sleep(FLAGS.apiDelay);

      const mediaUrls = place ? flatMedia(place) : [];
      log(`    images available: ${mediaUrls.length}`);
      if (mediaUrls.length < FLAGS.skipIfImagesLt) {
        log(`    ✗ SKIP — fewer than ${FLAGS.skipIfImagesLt} image candidates`);
        progress[slug] = 'skipped-no-img'; saveProgress(progress);
        skippedNoImg++;
        continue;
      }

      // Download up to FLAGS.photos images. If we end up with fewer than
      // FLAGS.minImages successful uploads, abandon the venue (the user
      // doesn't want sparse galleries).
      let images: string[] = [];
      const fetchLimit = Math.min(mediaUrls.length, FLAGS.photos * 3);
      for (const u of mediaUrls.slice(0, fetchLimit)) {
        if (images.length >= FLAGS.photos) break;
        if (FLAGS.dryRun) { images.push(u); continue; }
        try {
          images.push(await uploadImage(u));
        } catch (e) {
          log(`    img failed: ${String(e).slice(0, 100)}`);
        }
        await sleep(FLAGS.uploadDelay);
      }
      log(`    uploaded ${images.length}/${FLAGS.photos} images`);
      if (images.length < FLAGS.minImages) {
        log(`    ✗ SKIP — only ${images.length} usable images (need ${FLAGS.minImages})`);
        progress[slug] = 'skipped-too-few-img'; saveProgress(progress);
        skippedTooFew++;
        continue;
      }

      // Pick reviews (substantive only, dedupe authors)
      const picked: PisoReview[] = [];
      const seenAuthor = new Set<string>();
      const candReviews = (place?.review_list ?? [])
        .filter((r) => (r.text ?? '').trim().length >= 8 && (r.author_name ?? '').trim())
        .sort((a, b) =>
          ((b.rating ?? 0) - (a.rating ?? 0)) ||
          ((b.text ?? '').length - (a.text ?? '').length));
      for (const r of candReviews) {
        const author = (r.author_name ?? '').trim();
        if (seenAuthor.has(author)) continue;
        seenAuthor.add(author);
        picked.push(r);
        if (picked.length >= FLAGS.reviews) break;
      }

      const address = (c.location?.address?.full ?? '').slice(0, 240) || `${city.name}`;
      const website = (place?.contacts?.website ?? c.contacts?.website ?? '').trim();
      const hours = compactHours(c.opening_hours) || 'Liên hệ';
      const description = (place?.description ?? `${name} — ${city.name}.`).slice(0, 2000);
      const tags = [`${FLAGS.category}-discovered`];

      // Resolve canonical post-2025 ward at insert time so the row never lands
      // in DB with NULL ward_canonical. PISO gives us a full address string —
      // resolveWardFromVenue tries the district field first, then parses
      // address segments (drops street/number + city/country, takes what's in
      // the middle). Tag the rawDistrict with the resolved value so the
      // existing displayDistrict() fallback shows something sensible too.
      const wardResolve: ResolveResult | null = resolveWardFromVenue(null, address, cityWards);
      const rawDistrict = (wardResolve?.wardCanonical ?? '').slice(0, 80);
      if (wardResolve) {
        wardResolvedCount++;
        log(`    ⛳ ward: ${wardResolve.wardCanonical} (${wardResolve.method}${wardResolve.matchedVia ? ` via ${wardResolve.matchedVia}` : ''})`);
      } else {
        wardUnresolvedCount++;
        log(`    ⚠ ward unresolved — will leave NULL for backfill to handle`);
      }

      if (FLAGS.dryRun) {
        log(`    [dry-run] would import ${name} | ${images.length} imgs | ${picked.length} reviews | ward=${wardResolve?.wardCanonical ?? 'NULL'}`);
        imported++;
        continue;
      }

      let reviewsInserted = 0;
      await ds.transaction(async (mgr) => {
        const venue = await mgr.save(mgr.create(Venue, {
          slug,
          name: name.slice(0, 160),
          category: FLAGS.category as Category,
          cityId: city.id,
          district: rawDistrict,
          wardCanonical: wardResolve?.wardCanonical ?? null,
          wardType: wardResolve?.wardType ?? null,
          wardResolutionMethod: wardResolve?.method ?? null,
          address,
          description,
          website: /^https?:\/\//i.test(website) ? website.slice(0, 500) : null,
          images,
          tags,
          hours,
          priceRange: 2,
          lat, lng,
          rating: c.rating ?? 0,
          reviewCount: c.reviews ?? 0,
          externalRating: c.rating ?? 0,
          externalReviewCount: c.reviews ?? 0,
          externalId: c.data_id ?? null,
          externalOpeningHours: c.opening_hours ?? null,
          externalSyncedAt: new Date(),
          externalRaw: place ? buildExternalRaw(place, picked) : null,
          source: 'google',
          upvotes: seedRandom(slug, 2500, 100),
          isPublished: true,
        }));

        let sum = 0, inserted = 0;
        const usedUid = new Set<string>();
        for (const r of picked) {
          const uid = await getOrCreateReviewer(mgr, r.author_name ?? '', r.author_profile_pic ?? '', reviewerCache);
          if (usedUid.has(uid)) continue;
          usedUid.add(uid);
          const rating = Math.min(5, Math.max(1, Math.round(r.rating ?? 5)));
          // Preserve reviewer-attached photos (lh3.googleusercontent.com)
          // so the detail page can render them like Google Maps does. Raw
          // URLs — already in next/image whitelist + SafeImage fallback.
          const reviewPhotos = (r.photos ?? []).map((p) => p.url ?? '').filter(Boolean);
          await mgr.save(mgr.create(Review, {
            venueId: venue.id, userId: uid, rating, body: (r.text ?? '').slice(0, 4000),
            photos: reviewPhotos,
          }));
          sum += rating;
          inserted++;
        }
        if (inserted > 0) {
          const b = blend(c.rating ?? 0, c.reviews ?? 0, sum / inserted, inserted);
          await mgr.update(Venue, { id: venue.id }, b);
        }
        reviewsInserted = inserted;
      });

      progress[slug] = 'saved'; saveProgress(progress);
      imported++;
      log(`    ✓ IMPORTED (${imported}/${FLAGS.count}) — ${images.length} imgs, ${reviewsInserted} reviews`);
    } catch (e) {
      progress[slug] = 'failed'; saveProgress(progress);
      failed++;
      log(`    ✗ FAILED: ${String(e).slice(0, 200)}`);
    }
  }

  log(`\n▶ DONE city=${FLAGS.city} category=${FLAGS.category}`);
  log(`  imported=${imported}  skipped-no-img=${skippedNoImg}  skipped-too-few-img=${skippedTooFew}  failed=${failed}`);
  log(`  ward: ${wardResolvedCount} resolved / ${wardUnresolvedCount} unresolved`);
  log(`  cache: search ${cacheStats.searchHit}/${cacheStats.searchHit + cacheStats.searchMiss} hit, place ${cacheStats.placeHit}/${cacheStats.placeHit + cacheStats.placeMiss} hit`);
  log(`  log saved: ${LOG_FILE}`);
  await ds.destroy();
}

main().catch((err) => { console.error(err); process.exit(1); });
