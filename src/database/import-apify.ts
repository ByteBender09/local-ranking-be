import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { City, Venue } from './entities';
import type { Category } from './entities';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Apify "Google Maps Scraper" (compass/crawler-google-places) → Venue importer.
//
//  • Discovery + all fields + photos come from the scraper dataset (no Google
//    billing, works from VN). Only keeps places with rating > 4.0.
//  • Photos: imageUrls are directly downloadable → sharp WebP → POST to the
//    deployed /admin/uploads so files land on the Railway volume.
//  • external_raw stores the FULL scraped item (reviews, phone, website,
//    popular times…) so we never re-scrape, even though FE/app ignore it now.
//  • Idempotent: skips venues whose slug or external_id already exists; the
//    progress checkpoint avoids re-uploading photos on restart.
//
// USAGE
//   Test 1 venue end-to-end:   npm run import:apify -- --city=da-lat --limit=1
//   Full run:                  npm run import:apify
// FLAGS  --venues=1500 --photos=5 --reviews=10 --min-rating=4.0 --city=<slug>
//        --limit=<n> --dry-run
// ENV    APIFY_TOKEN, BACKEND_PUBLIC_URL, IMPORT_ADMIN_JWT, DATABASE_URL
// ─────────────────────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const FLAGS = {
  totalVenues: parseInt(arg('venues', '1500'), 10),
  photos: parseInt(arg('photos', '5'), 10),
  reviews: parseInt(arg('reviews', '5'), 10),
  minRating: parseFloat(arg('min-rating', '4.0')),
  onlyCity: arg('city', ''),
  limit: parseInt(arg('limit', '0'), 10),
  // Delay (ms) between image uploads. With the /admin/uploads endpoint now
  // exempt from the throttler (@SkipThrottle), a small gentle delay suffices.
  uploadDelay: parseInt(arg('upload-delay', '300'), 10),
  dryRun: process.argv.includes('--dry-run'),
};

const TOKEN = process.env.APIFY_TOKEN ?? '';
const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const ADMIN_JWT = process.env.IMPORT_ADMIN_JWT ?? '';
const ACTOR = 'compass~crawler-google-places';
const CHECKPOINT = resolve(process.cwd(), 'import-progress.json');

const CITY_WEIGHTS: Record<string, number> = {
  'ho-chi-minh': 220, 'ha-noi': 220, 'da-nang': 160, 'da-lat': 140,
  'hoi-an': 130, 'nha-trang': 120, 'phu-quoc': 110, hue: 100,
  'vung-tau': 90, 'hai-phong': 80, 'sa-pa': 70, 'ca-mau': 60,
};

// Search term per category; the term is matched back from item.searchString.
const CATEGORY_TERMS: { category: Category; term: string }[] = [
  { category: 'cafe', term: 'cà phê' },
  { category: 'restaurant', term: 'nhà hàng' },
  { category: 'street_food', term: 'quán ăn vặt' },
  { category: 'viewpoint', term: 'địa điểm tham quan' },
  { category: 'beach', term: 'bãi biển' },
  { category: 'homestay', term: 'homestay' },
  { category: 'bar', term: 'quán bar' },
  { category: 'museum', term: 'bảo tàng' },
  { category: 'park', term: 'công viên' },
  { category: 'shopping', term: 'trung tâm thương mại' },
];

interface ApifyPlace {
  title?: string;
  description?: string;
  categoryName?: string;
  categories?: string[];
  reviewsTags?: { title?: string; count?: number }[];
  searchString?: string;
  address?: string;
  neighborhood?: string;
  street?: string;
  city?: string;
  location?: { lat: number; lng: number };
  totalScore?: number;
  reviewsCount?: number;
  price?: string;
  placeId?: string;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  imageUrls?: string[];
  openingHours?: { day: string; hours: string }[];
  [k: string]: unknown;
}
// placeId → status, plus `city:<slug>` → 'done' markers (city-level resume).
type Progress = Record<string, string>;

// Heavy fields we never use — stripped from external_raw to keep rows small.
const RAW_DROP = new Set([
  'webResults', 'popularTimesHistogram', 'popularTimesLiveText',
  'popularTimesLivePercent', 'reviewsDistribution', 'questionsAndAnswers',
  'peopleAlsoSearch', 'hotelAds', 'ownerUpdates', 'updatesFromCustomers',
  'gasPrices', 'restaurantData', 'imageCategories', 'adrFormatAddress',
  'googleMapsLinks', 'tableReservationLinks', 'bookingLinks', 'leadsEnrichment',
]);
function trimRaw(p: ApifyPlace): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (!RAW_DROP.has(k)) out[k] = v;
  return out;
}

// Up to 6 venue tags from Google categories + review keywords.
function buildTags(p: ApifyPlace): string[] {
  const raw: string[] = [];
  for (const c of p.categories ?? []) if (typeof c === 'string') raw.push(c);
  for (const t of p.reviewsTags ?? []) if (t?.title) raw.push(t.title);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const key = r.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r.trim().slice(0, 40));
    if (out.length >= 6) break;
  }
  return out;
}

// Deterministic small initial upvotes so imported venues aren't all flat at 0
// (gives trending/sorting some life until real votes arrive).
function seedUpvotes(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h % 50;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slugify = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function categorize(p: ApifyPlace): Category {
  const ss = (p.searchString ?? '').toLowerCase();
  for (const c of CATEGORY_TERMS) if (ss.includes(c.term.toLowerCase())) return c.category;
  const cn = (p.categoryName ?? '').toLowerCase();
  if (/cà phê|coffee|cafe/.test(cn)) return 'cafe';
  if (/bảo tàng|museum|gallery/.test(cn)) return 'museum';
  if (/công viên|park/.test(cn)) return 'park';
  if (/biển|beach/.test(cn)) return 'beach';
  if (/bar|pub|club/.test(cn)) return 'bar';
  if (/homestay|khách sạn|nhà nghỉ|hotel|hostel/.test(cn)) return 'homestay';
  if (/chợ|cửa hàng|mua sắm|mall|shop|store/.test(cn)) return 'shopping';
  if (/quán ăn|ăn vặt|street/.test(cn)) return 'street_food';
  if (/tham quan|attraction|viewpoint|ngắm/.test(cn)) return 'viewpoint';
  return 'restaurant';
}

function priceTier(price?: string): number {
  if (!price) return 2;
  if (/^\$+$/.test(price.trim())) return Math.min(4, price.trim().length);
  const nums = (price.replace(/[.,]/g, '').match(/\d+/g) ?? []).map(Number);
  const max = nums.length ? Math.max(...nums) : 0;
  if (max <= 0) return 2;
  if (max < 150000) return 1;
  if (max < 350000) return 2;
  if (max < 700000) return 3;
  return 4;
}

function compactHours(oh?: { day: string; hours: string }[]): string {
  if (!oh || oh.length === 0) return 'Xem giờ mở cửa';
  const h = oh[0].hours ?? '';
  const m = h.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
  if (m) return `${m[1]}–${m[2]}`.slice(0, 64);
  if (/24|cả ngày/i.test(h)) return '24/7';
  return 'Xem giờ mở cửa';
}

function buildDescription(p: ApifyPlace, category: Category, cityName: string): string {
  // Prefer Google's own place description when present; else a clean template.
  const own = (typeof p.description === 'string' ? p.description : '').trim();
  if (own) return own.slice(0, 1000);
  const district = p.neighborhood || p.street || cityName;
  const labels: Record<Category, string> = {
    cafe: 'Quán cà phê', restaurant: 'Nhà hàng', street_food: 'Quán ăn',
    viewpoint: 'Điểm tham quan', beach: 'Bãi biển', homestay: 'Homestay',
    bar: 'Quán bar', museum: 'Bảo tàng', park: 'Công viên', shopping: 'Địa điểm mua sắm',
  };
  const r = p.totalScore ? `${p.totalScore.toFixed(1)}★` : '';
  const n = p.reviewsCount ? ` (${p.reviewsCount} đánh giá)` : '';
  return `${labels[category]} tại ${district}, ${cityName}. ${r}${n}`.trim();
}

async function withRetry<T>(fn: () => Promise<T>, label: string, tries = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const s = axios.isAxiosError(e) ? e.response?.status : undefined;
      // Retry on 5xx, 429 (rate limit) and 403 — Apify's FREE plan transiently
      // rejects run-starts with 403 under load; it clears after a short wait.
      // Other 4xx are permanent → give up.
      if (s && s < 500 && s !== 429 && s !== 403) break;
      await sleep(s === 429 || s === 403 ? 20000 : 1000 * (i + 1));
    }
  }
  throw new Error(`${label} failed: ${String(last)}`);
}

// ── Apify API ────────────────────────────────────────────────────────────────
async function fetchItems(datasetId: string): Promise<ApifyPlace[]> {
  const out: ApifyPlace[] = [];
  let offset = 0;
  const pageLimit = 200;
  for (;;) {
    const r = await withRetry(
      () => axios.get<ApifyPlace[]>(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${TOKEN}&clean=true&offset=${offset}&limit=${pageLimit}`,
        { timeout: 30000 }),
      'fetch items',
    );
    const batch = Array.isArray(r.data) ? r.data : [];
    out.push(...batch);
    if (batch.length < pageLimit) break;
    offset += batch.length;
  }
  return out;
}

// Start an actor run and wait until it finishes, returning scraped items.
async function scrapeCity(cityName: string, maxPerSearch: number): Promise<ApifyPlace[]> {
  const startRes = await withRetry(
    () => axios.post(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${TOKEN}`,
      {
        searchStringsArray: CATEGORY_TERMS.map((c) => c.term),
        locationQuery: `${cityName}, Vietnam`,
        maxCrawledPlacesPerSearch: maxPerSearch,
        language: 'vi',
        maxImages: FLAGS.photos,
        maxReviews: FLAGS.reviews,
        skipClosedPlaces: true,
        scrapeReviewsPersonalData: false,
        // Server-side rating filter so Apify only scrapes (and only bills for)
        // places ≥ 4.0★. The client still enforces strict > 4.0 below to drop
        // exactly-4.0. 'four' also excludes places with no reviews.
        placeMinimumStars: 'four',
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }),
    'start run',
  );
  const runId = startRes.data.data.id as string;
  const datasetId = startRes.data.data.defaultDatasetId as string;

  // Poll run status until terminal.
  for (;;) {
    await sleep(6000);
    const st = await withRetry(
      () => axios.get(`https://api.apify.com/v2/actor-runs/${runId}?token=${TOKEN}`, { timeout: 20000 }),
      'poll run',
    );
    const status = st.data.data.status as string;
    if (status === 'SUCCEEDED') { console.log('    run SUCCEEDED'); break; }
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      // Don't return partial data on a bad run — throw so the caller skips the
      // city WITHOUT marking it done, and it gets retried on the next run.
      throw new Error(`run ${status}`);
    }
  }
  return fetchItems(datasetId);
}

async function uploadImage(url: string): Promise<string> {
  // 1) Fetch the Google image ONCE and convert to WebP. This buffer is kept and
  //    reused for the upload + EVERY upload retry — we never re-fetch from
  //    Google (a successful fetch is never wasted; no mid-retry 403 risk).
  const img = await withRetry(
    () => axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 30000 }),
    'download image', 3,
  );
  const webp = await sharp(Buffer.from(img.data))
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // 2) Upload the saved buffer. Only the multipart wrapper is rebuilt per
  //    attempt (a body stream is single-use); the image bytes are reused.
  //    Retry hard on 429 so throttling only slows us — it never loses an image.
  const up = await withRetry(
    () => {
      const fd = new FormData();
      fd.append('file', new Blob([new Uint8Array(webp)], { type: 'image/webp' }), 'g.webp');
      return axios.post<{ data?: { url?: string }; url?: string }>(
        `${BACKEND}/admin/uploads`, fd,
        { headers: { Authorization: `Bearer ${ADMIN_JWT}` }, maxBodyLength: Infinity, timeout: 30000 },
      );
    },
    'upload', 8,
  );
  // The API wraps responses as { success, data: { url, ... } }.
  const out = up.data?.data?.url ?? up.data?.url;
  if (!out) throw new Error('upload returned no url');
  return out;
}

function loadProgress(): Progress {
  if (!existsSync(CHECKPOINT)) return {};
  try { return JSON.parse(readFileSync(CHECKPOINT, 'utf8')) as Progress; } catch { return {}; }
}
function saveProgress(p: Progress): void { writeFileSync(CHECKPOINT, JSON.stringify(p)); }

async function main(): Promise<void> {
  if (!TOKEN) throw new Error('APIFY_TOKEN is required');
  if (!FLAGS.dryRun && (!BACKEND || !ADMIN_JWT))
    throw new Error('BACKEND_PUBLIC_URL + IMPORT_ADMIN_JWT required (unless --dry-run)');

  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const cityRepo = ds.getRepository(City);
  const venueRepo = ds.getRepository(Venue);

  const cities = (await cityRepo.find()).filter((c) => !FLAGS.onlyCity || c.slug === FLAGS.onlyCity);
  const weightTotal = Object.values(CITY_WEIGHTS).reduce((a, b) => a + b, 0);
  const scale = FLAGS.totalVenues / weightTotal;

  const progress = loadProgress();
  let created = 0, skipped = 0, failed = 0;
  const limitReached = () => FLAGS.limit > 0 && created >= FLAGS.limit;

  for (const city of cities) {
    if (limitReached()) break;
    // City-level resume: skip cities already fully scraped+processed so a
    // restart never re-scrapes (and re-bills) a completed city.
    if (progress[`city:${city.slug}`] === 'done') {
      console.log(`\n${city.slug}: already done — skip`);
      continue;
    }
    const weight = CITY_WEIGHTS[city.slug] ?? Math.round(weightTotal / cities.length);
    const cityQuota = Math.max(1, Math.round(weight * scale));
    const perCategory = FLAGS.limit > 0
      ? Math.max(2, FLAGS.limit)
      : Math.ceil(cityQuota / CATEGORY_TERMS.length);

    console.log(`\n${city.slug}: scraping (≤${perCategory}/category)…`);
    let items: ApifyPlace[];
    try {
      items = await scrapeCity(city.name, perCategory);
    } catch (e) {
      console.warn(`  scrape failed for ${city.slug}: ${String(e)}`);
      continue;
    }
    console.log(`  ${items.length} raw places`);

    for (const p of items) {
      if (limitReached()) break;
      const placeId = p.placeId ?? '';
      if (!placeId || progress[placeId] === 'saved') { skipped++; continue; }
      // Quality gate.
      if ((p.totalScore ?? 0) <= FLAGS.minRating) continue;
      if (p.permanentlyClosed || p.temporarilyClosed) continue;
      if (!p.imageUrls || p.imageUrls.length === 0) continue;
      // Skip places without real coordinates (would pin at 0,0 on the map).
      if (typeof p.location?.lat !== 'number' || typeof p.location?.lng !== 'number'
          || (p.location.lat === 0 && p.location.lng === 0)) continue;
      const name = (p.title ?? '').trim();
      if (!name) continue;

      const category = categorize(p);
      const slug = `${slugify(name)}-${city.slug}`;

      if (FLAGS.dryRun) {
        console.log(`  [dry] ${name} | ${category} | ${p.totalScore}★ | ${p.imageUrls.length} imgs`);
        created++;
        continue;
      }

      try {
        const exists = await venueRepo.findOne({
          where: [{ slug }, { externalId: placeId }], select: { id: true },
        });
        if (exists) { progress[placeId] = 'skipped'; saveProgress(progress); skipped++; continue; }

        // Try more candidate URLs than needed and stop once we have `photos`
        // successful uploads — so a few 403/timeout failures don't shrink the
        // gallery.
        const images: string[] = [];
        for (const url of p.imageUrls.slice(0, FLAGS.photos * 3)) {
          if (images.length >= FLAGS.photos) break;
          try { images.push(await uploadImage(url)); }
          catch (e) { console.warn(`    img failed: ${String(e)}`); }
          await sleep(FLAGS.uploadDelay); // throttle-friendly spacing
        }
        if (images.length === 0) { progress[placeId] = 'skipped'; saveProgress(progress); skipped++; continue; }

        const rating = p.totalScore ?? 0;
        const reviewCount = p.reviewsCount ?? 0;
        await venueRepo.save(venueRepo.create({
          slug,
          name: name.slice(0, 160),
          category,
          cityId: city.id,
          district: (p.neighborhood || p.street || city.name).slice(0, 80),
          address: (p.address ?? '').slice(0, 240),
          description: buildDescription(p, category, city.name),
          images,
          rating,
          reviewCount,
          externalRating: rating,
          externalReviewCount: reviewCount,
          externalId: placeId,
          externalOpeningHours: (p.openingHours ?? null) as unknown as string[] | null,
          externalSyncedAt: new Date(),
          externalRaw: trimRaw(p),
          source: 'google',
          upvotes: seedUpvotes(slug),
          priceRange: priceTier(p.price),
          tags: buildTags(p),
          hours: compactHours(p.openingHours),
          lat: p.location?.lat ?? 0,
          lng: p.location?.lng ?? 0,
          isPublished: true,
        }));
        progress[placeId] = 'saved'; saveProgress(progress);
        created++;
        if (created % 25 === 0) console.log(`  …saved ${created}`);
      } catch (e) {
        progress[placeId] = 'failed'; saveProgress(progress); failed++;
        console.warn(`  FAILED ${name}: ${String(e)}`);
      }
    }
    // City fully processed — mark done so a restart skips its scrape entirely.
    // Only in a full run (not --limit test / not --dry-run).
    if (FLAGS.limit === 0 && !FLAGS.dryRun) {
      progress[`city:${city.slug}`] = 'done';
      saveProgress(progress);
      console.log(`  ✓ ${city.slug} done`);
    }
  }

  console.log(`\n✓ Done. created=${created} skipped=${skipped} failed=${failed}`);
  await ds.destroy();
}

main().catch((err) => { console.error(err); process.exit(1); });
