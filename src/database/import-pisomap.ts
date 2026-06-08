import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { DataSource, EntityManager } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { City, Venue, User, Review, Ward } from './entities';
import type { Category } from './entities';
import { LANDMARK_VENUES } from './seed-data/landmark-venues';
import {
  resolveWardFromVenue,
  toNormalizable,
  type NormalizableWard,
  type ResolveResult,
} from '../modules/venues/ward-resolver';
import { buildExternalRaw } from './piso-to-external-raw';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// PISO Maps → Venue importer for the curated landmark list (landmark-venues.ts).
//
// For each curated place:
//   1. /api/maps/search?q=<name>&lat&lng     → match → data_id + accurate
//      location / address / rating / hours.
//   2. /api/maps/place?data_id=...           → description, photos, reviews.
//   3. Download up to N photos → WebP → POST /admin/uploads (Railway volume).
//   4. Up to M reviews → synthetic reviewer users + Review rows; venue
//      rating/reviewCount set to the same blend ReviewsService would compute.
//   5. Curated fields (name, category, district, tags, priceRange, description)
//      are kept; PISO supplies the accurate factual data + media + reviews.
//
// Idempotent: skips venues whose slug or externalId already exists; a JSON
// checkpoint records per-place status so a restart never re-uploads photos.
//
// USAGE   npm run import:pisomap -- --city=ninh-binh --limit=1   (test one)
//         npm run import:pisomap                                  (full run)
// FLAGS   --city=<slug> --limit=<n> --photos=5 --reviews=4 --dry-run
// ENV     PISOMAP_API_KEY, BACKEND_PUBLIC_URL, IMPORT_ADMIN_JWT, DATABASE_URL
// ─────────────────────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const FLAGS = {
  onlyCity: arg('city', ''),
  limit: parseInt(arg('limit', '0'), 10),
  photos: parseInt(arg('photos', '5'), 10),
  reviews: parseInt(arg('reviews', '4'), 10),
  // STRICT quality filters — venues failing any are skipped entirely. There
  // is no Unsplash pool fallback anywhere; a venue with too few real photos
  // simply doesn't get imported.
  minRating: parseFloat(arg('min-rating', '4.0')),
  minReviews: parseInt(arg('min-reviews', '200'), 10),
  minImages: parseInt(arg('min-images', '5'), 10),
  uploadDelay: parseInt(arg('upload-delay', '300'), 10),
  apiDelay: parseInt(arg('api-delay', '500'), 10),
  dryRun: process.argv.includes('--dry-run'),
};

const API_KEY = process.env.PISOMAP_API_KEY ?? '';
const API_BASE = 'https://api.pisomap.tech/api/maps';
const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const ADMIN_JWT = process.env.IMPORT_ADMIN_JWT ?? '';
const CHECKPOINT = resolve(process.cwd(), 'import-pisomap-progress.json');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slugify = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Loose token-overlap similarity on diacritic-stripped names (0..1).
function nameSim(a: string, b: string): number {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const A = new Set(norm(a));
  const B = new Set(norm(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

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
      if (s && s < 500 && s !== 429) break; // permanent 4xx (except rate-limit)
      await sleep(s === 429 ? 15000 : 1000 * (i + 1));
    }
  }
  throw new Error(`${label} failed: ${String(last)}`);
}

// ── PISO API ───────────────────────────────────────────────────────────────
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
  const r = await withRetry(
    () => axios.get<{ local_result?: PisoSearchItem[] }>(`${API_BASE}/search`, {
      params: { q, lat, lng }, headers: { 'x-api-key': API_KEY }, timeout: 30000,
    }), 'search');
  return r.data?.local_result ?? [];
}
async function apiPlace(dataId: string, lat: number, lng: number): Promise<PisoPlace | null> {
  const r = await withRetry(
    () => axios.get<{ place_result?: PisoPlace }>(`${API_BASE}/place`, {
      params: { data_id: dataId, lat, lng }, headers: { 'x-api-key': API_KEY }, timeout: 30000,
    }), 'place');
  return r.data?.place_result ?? null;
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

// Reuse one synthetic reviewer per Google author (deduped by handle). These are
// placeholder accounts (isSynthetic = true) used to attach scraped Google
// reviews; the web detail page renders their reviews in the "Google reviews"
// section with only the photo + name (no @handle), distinct from real in-app
// reviews. NOT real logins (no googleId/email).
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
  existsSync(CHECKPOINT) ? JSON.parse(readFileSync(CHECKPOINT, 'utf8')) : {};
const saveProgress = (p: Progress) => writeFileSync(CHECKPOINT, JSON.stringify(p));

async function main(): Promise<void> {
  if (!API_KEY) throw new Error('PISOMAP_API_KEY required');
  if (!FLAGS.dryRun && (!BACKEND || !ADMIN_JWT))
    throw new Error('BACKEND_PUBLIC_URL + IMPORT_ADMIN_JWT required (unless --dry-run)');

  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const cityRepo = ds.getRepository(City);
  const venueRepo = ds.getRepository(Venue);

  const progress = loadProgress();
  const reviewerCache = new Map<string, string>();
  let created = 0, skipped = 0, notFound = 0, failed = 0;
  let droppedRating = 0, droppedReviews = 0, droppedImages = 0;
  const limitReached = () => FLAGS.limit > 0 && created >= FLAGS.limit;

  // Pre-load wards for every city we'll touch — resolve canonical post-2025
  // ward at insert time so rows never land in DB with NULL ward_canonical.
  console.log(`Strict filters: rating>${FLAGS.minRating}, reviews>${FLAGS.minReviews}, images>=${FLAGS.minImages} (NO Unsplash fallback)`);
  const allWards = await ds.getRepository(Ward).find({ relations: ['city'] });
  const wardsByCity = new Map<string, NormalizableWard[]>();
  for (const w of allWards) {
    const slug = w.city.slug;
    const list = wardsByCity.get(slug) ?? [];
    list.push(...toNormalizable([{
      name: w.name,
      type: w.type as 'phuong' | 'xa' | 'dac_khu',
      aliasesOldDistrict: w.aliasesOldDistrict ?? [],
      aliasesOldWards: w.aliasesOldWards ?? [],
      aliasesUser: w.aliasesUser ?? [],
    }]));
    wardsByCity.set(slug, list);
  }
  console.log(`Loaded ${allWards.length} wards across ${wardsByCity.size} cities`);

  for (const [citySlug, seeds] of Object.entries(LANDMARK_VENUES)) {
    if (FLAGS.onlyCity && citySlug !== FLAGS.onlyCity) continue;
    if (limitReached()) break;
    const city = await cityRepo.findOne({ where: { slug: citySlug } });
    if (!city) { console.warn(`⚠ city ${citySlug} not found — skip`); continue; }
    const cityWards = wardsByCity.get(citySlug) ?? [];
    console.log(`\n=== ${citySlug} (${seeds.length}, ${cityWards.length} wards) ===`);

    for (const seed of seeds) {
      if (limitReached()) break;
      const slug = `${slugify(seed.name)}-${citySlug}`;
      if (progress[slug] === 'saved' || progress[slug] === 'skipped') { skipped++; continue; }

      const exists = await venueRepo.findOne({ where: { slug }, select: { id: true } });
      if (exists) { progress[slug] = 'skipped'; saveProgress(progress); skipped++; continue; }

      try {
        // 1) search → best match
        const results = await apiSearch(seed.name, seed.lat, seed.lng);
        await sleep(FLAGS.apiDelay);
        let best: PisoSearchItem | null = null, bestScore = 0;
        for (const r of results) {
          const sim = nameSim(seed.name, r.title ?? '');
          const la = r.location?.latitude, lo = r.location?.longitude;
          const near = typeof la === 'number' && typeof lo === 'number'
            ? haversineKm(seed.lat, seed.lng, la, lo) : 999;
          if (near > 120) continue;
          const score = sim + (near < 5 ? 0.15 : 0);
          if (score > bestScore) { bestScore = score; best = r; }
        }
        let matched = best && bestScore >= 0.45 ? best : null;
        // Two curated entries can resolve to the SAME Google place (e.g. a food
        // stall inside a market). external_id is unique, so if it's already
        // taken, import this one as curated (own data + pool images) instead of
        // crashing the insert.
        if (matched?.data_id) {
          const dupExt = await venueRepo.findOne({
            where: { externalId: matched.data_id }, select: { id: true },
          });
          if (dupExt) {
            console.log(`  ~ data_id already used — importing "${seed.name}" as curated`);
            matched = null;
          }
        }

        // 2) place detail (photos + reviews + description)
        let place: PisoPlace | null = null;
        if (matched?.data_id) { place = await apiPlace(matched.data_id, seed.lat, seed.lng); await sleep(FLAGS.apiDelay); }

        const lat = matched?.location?.latitude ?? seed.lat;
        const lng = matched?.location?.longitude ?? seed.lng;
        const address = (matched?.location?.address?.full ?? seed.address).slice(0, 240);
        const extRating = matched?.rating ?? 0;
        const extReviews = matched?.reviews ?? 0;
        const hours = compactHours(matched?.opening_hours) || seed.hours;

        if (!matched) {
          // STRICT mode (post-2026-06 audit): no PISO match = no real photos/
          // reviews = reject. Previously we'd fall through with curated data
          // + Unsplash pool images — that's exactly the failure mode the user
          // surfaced ("vẫn còn ảnh Unsplash sau khi import").
          notFound++;
          progress[slug] = 'skipped-no-match'; saveProgress(progress);
          console.log(`  ✗ SKIP — no PISO match for "${seed.name}" (would have needed Unsplash fallback)`);
          continue;
        }

        // QUALITY GATE — apply BEFORE downloading anything.
        if (extRating <= FLAGS.minRating) {
          droppedRating++;
          progress[slug] = 'skipped-rating'; saveProgress(progress);
          console.log(`  ✗ SKIP — rating ${extRating} <= ${FLAGS.minRating}: ${seed.name}`);
          continue;
        }
        if (extReviews <= FLAGS.minReviews) {
          droppedReviews++;
          progress[slug] = 'skipped-reviews'; saveProgress(progress);
          console.log(`  ✗ SKIP — reviews ${extReviews} <= ${FLAGS.minReviews}: ${seed.name}`);
          continue;
        }

        if (FLAGS.dryRun) {
          const media = place ? flatMedia(place) : [];
          const revs = (place?.review_list ?? []).filter((r) => (r.text ?? '').trim());
          console.log(`  [dry] ${seed.name} → MATCH "${matched.title}" ${extRating}★/${extReviews} | imgs=${media.length} reviews=${revs.length} @ ${lat.toFixed(4)},${lng.toFixed(4)}`);
          created++;
          continue;
        }

        // 3) photos → upload. NO Unsplash fallback: if we can't upload at
        // least --min-images real photos to our CDN, the venue is rejected.
        let images: string[] = [];
        const mediaUrls = place ? flatMedia(place) : [];
        for (const u of mediaUrls.slice(0, FLAGS.photos * 3)) {
          if (images.length >= FLAGS.photos) break;
          try { images.push(await uploadImage(u)); } catch (e) { console.warn(`    img failed: ${String(e)}`); }
          await sleep(FLAGS.uploadDelay);
        }
        if (images.length < FLAGS.minImages) {
          droppedImages++;
          progress[slug] = 'skipped-images'; saveProgress(progress);
          console.log(`  ✗ SKIP — only ${images.length} usable images (need ${FLAGS.minImages}): ${seed.name}`);
          continue;
        }

        // 4) reviews — prefer substantive (longer text) + higher rating, dedupe
        // authors. Sort candidates so the most meaningful reviews win the N slots.
        const picked: PisoReview[] = [];
        const seenAuthor = new Set<string>();
        const candidates = (place?.review_list ?? [])
          .filter((r) => (r.text ?? '').trim().length >= 8 && (r.author_name ?? '').trim())
          .sort((a, b) =>
            ((b.rating ?? 0) - (a.rating ?? 0)) ||
            ((b.text ?? '').length - (a.text ?? '').length));
        for (const r of candidates) {
          const author = (r.author_name ?? '').trim();
          if (seenAuthor.has(author)) continue;
          seenAuthor.add(author);
          picked.push(r);
          if (picked.length >= FLAGS.reviews) break;
        }

        const website = (place?.contacts?.website ?? matched?.contacts?.website ?? '').trim();

        // Resolve canonical post-2025 ward — try seed.district first (the
        // curator's intent), then fall back to parsing the PISO address. The
        // venue row lands in DB with ward_canonical/ward_type/method already
        // populated so the search UI's ward filter works immediately.
        const wardResolve: ResolveResult | null = resolveWardFromVenue(
          seed.district,
          address,
          cityWards,
        );
        if (wardResolve) {
          console.log(`    ⛳ ward: ${wardResolve.wardCanonical} (${wardResolve.method})`);
        } else {
          console.log(`    ⚠ ward unresolved — backfill script will retry with geo fallback`);
        }

        let reviewsInserted = 0;
        await ds.transaction(async (mgr) => {
          const venue = await mgr.save(mgr.create(Venue, {
            slug,
            name: seed.name.slice(0, 160),
            category: seed.category as Category,
            cityId: city.id,
            district: seed.district.slice(0, 80),
            wardCanonical: wardResolve?.wardCanonical ?? null,
            wardType: wardResolve?.wardType ?? null,
            wardResolutionMethod: wardResolve?.method ?? null,
            address,
            description: seed.description,
            website: /^https?:\/\//i.test(website) ? website.slice(0, 500) : null,
            images,
            tags: seed.tags,
            hours,
            priceRange: seed.priceRange,
            lat, lng,
            rating: extRating || (4.0 + seedRandom(slug, 90) / 100),
            reviewCount: extReviews,
            externalRating: extRating,
            externalReviewCount: extReviews,
            externalId: matched?.data_id ?? null,
            externalOpeningHours: matched?.opening_hours ?? null,
            externalSyncedAt: matched ? new Date() : null,
            externalRaw: place ? buildExternalRaw(place, picked) : null,
            source: 'google',
            upvotes: seedRandom(slug, 2500, 100),
            isPublished: true,
          }));

          // Scraped Google reviews → synthetic reviewer users + Review rows. The
          // venue rating/reviewCount are set to the same blend ReviewsService
          // would compute. The web detail page renders these (synthetic-user)
          // reviews in the Google section with photo + name only.
          let sum = 0, inserted = 0;
          const usedUid = new Set<string>(); // distinct reviewer per venue (uq_review_user_venue)
          for (const r of picked) {
            const uid = await getOrCreateReviewer(mgr, r.author_name ?? '', r.author_profile_pic ?? '', reviewerCache);
            if (usedUid.has(uid)) continue; // two author names collapsed to one user → skip dup
            usedUid.add(uid);
            const rating = Math.min(5, Math.max(1, Math.round(r.rating ?? 5)));
            // Preserve reviewer-attached photos from Google (Apify-style).
            const reviewPhotos = (r.photos ?? []).map((p) => p.url ?? '').filter(Boolean);
            await mgr.save(mgr.create(Review, {
              venueId: venue.id, userId: uid, rating, body: (r.text ?? '').slice(0, 4000),
              photos: reviewPhotos,
            }));
            sum += rating;
            inserted++;
          }
          if (inserted > 0) {
            const b = blend(extRating, extReviews, sum / inserted, inserted);
            await mgr.update(Venue, { id: venue.id }, b);
          }
          reviewsInserted = inserted;
        });

        progress[slug] = 'saved'; saveProgress(progress);
        created++;
        console.log(`  ✓ ${seed.name} | ${images.length} imgs | ${reviewsInserted} reviews | ${matched ? `${extRating}★` : 'curated'}`);
      } catch (e) {
        progress[slug] = 'failed'; saveProgress(progress); failed++;
        console.warn(`  FAILED ${seed.name}: ${String(e)}`);
      }
    }
  }

  console.log(`\n✓ Done.`);
  console.log(`  created=${created} skipped(existing)=${skipped} failed=${failed}`);
  console.log(`  rejected: no-match=${notFound} rating=${droppedRating} reviews=${droppedReviews} images=${droppedImages}`);
  await ds.destroy();
}

main().catch((err) => { console.error(err); process.exit(1); });
