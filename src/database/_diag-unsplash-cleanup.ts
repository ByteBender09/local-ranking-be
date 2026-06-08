import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, statSync } from 'fs';
import { resolve } from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { DataSource, EntityManager } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue, Ward, User, Review } from './entities';
import {
  resolveWardFromVenue,
  toNormalizable,
  type NormalizableWard,
  type ResolveResult,
} from '../modules/venues/ward-resolver';
import { buildExternalRaw } from './piso-to-external-raw';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Unsplash placeholder cleanup.
//
// Walks every venue whose images[] is entirely from images.unsplash.com (the
// fake pool that earlier seed batches used as a fallback) and tries to
// upgrade them with real PISO data.
//
// Quality gate (default):
//   rating  > 4.0
//   reviews > 100
//   uploadable real images >= 4
//
// If a venue passes after re-fetch:
//   - photos: download → WebP → upload to homnaydidau.xyz CDN, replace images[]
//   - rating / external_review_count / external_rating: refresh from PISO
//   - ward_canonical / ward_type / ward_resolution_method: re-resolve from
//     the refreshed address against the ward index
//   - reviews: replace the synthetic-user reviews with the freshest 4 from
//     PISO; reviewer-attached photos are saved on review.photos[] (Apify-
//     style, served straight from lh3.googleusercontent.com — no rehost)
//
// If still fails:
//   - softDelete() (reversible via UPDATE venues SET deleted_at = NULL)
//
// SAFETY: dry-run by default. Pass --apply.
// Cache: reuses import-pisomap-cache/ (search + place TTL).
//
//   npx ts-node src/database/_diag-unsplash-cleanup.ts                  (dry-run, all cities)
//   npx ts-node src/database/_diag-unsplash-cleanup.ts --city=da-lat --dry-run
//   npx ts-node src/database/_diag-unsplash-cleanup.ts --apply
// ─────────────────────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const FLAGS = {
  city: arg('city', ''),
  limit: parseInt(arg('limit', '0'), 10),
  minRating: parseFloat(arg('min-rating', '4.0')),
  minReviews: parseInt(arg('min-reviews', '100'), 10),
  minImages: parseInt(arg('min-images', '4'), 10),
  photos: parseInt(arg('photos', '5'), 10),
  reviews: parseInt(arg('reviews', '4'), 10),
  uploadDelay: parseInt(arg('upload-delay', '300'), 10),
  apiDelay: parseInt(arg('api-delay', '500'), 10),
  cacheTtlDays: parseInt(arg('cache-ttl-days', '7'), 10),
  noCache: process.argv.includes('--no-cache'),
  apply: process.argv.includes('--apply'),
};

const API_KEY = process.env.PISOMAP_API_KEY ?? '';
const API_BASE = 'https://api.pisomap.tech/api/maps';
const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const ADMIN_JWT = process.env.IMPORT_ADMIN_JWT ?? '';

const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const LOG_FILE = resolve(process.cwd(), `unsplash-cleanup-${FLAGS.city || 'all'}-${RUN_ID}.log`);
const CACHE_DIR = resolve(process.cwd(), 'import-pisomap-cache');
const CACHE_SEARCH_DIR = resolve(CACHE_DIR, 'search');
const CACHE_PLACE_DIR = resolve(CACHE_DIR, 'place');

function ensureCacheDirs(): void {
  if (FLAGS.noCache) return;
  for (const d of [CACHE_DIR, CACHE_SEARCH_DIR, CACHE_PLACE_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

function log(line: string): void {
  const stamped = `[${new Date().toISOString().slice(11, 19)}] ${line}`;
  console.log(stamped);
  try { appendFileSync(LOG_FILE, stamped + '\n'); } catch { /* no-op */ }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slugify = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

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

interface PisoMedia { id?: string; url?: string }
interface PisoSearchItem {
  data_id?: string; title?: string; rating?: number; reviews?: number;
  location?: { latitude?: number; longitude?: number; address?: { full?: string } };
  opening_hours?: { day: string; hours: string }[];
  contacts?: { phone?: string; website?: string };
}
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

function placeCacheFile(dataId: string): string {
  return resolve(CACHE_PLACE_DIR, `${dataId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
}
function readPlaceCache(dataId: string): PisoPlace | null {
  if (FLAGS.noCache) return null;
  const f = placeCacheFile(dataId);
  if (!existsSync(f)) return null;
  try {
    if (Date.now() - statSync(f).mtimeMs > FLAGS.cacheTtlDays * 86400000) return null;
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch { return null; }
}
function writePlaceCache(dataId: string, place: PisoPlace): void {
  if (FLAGS.noCache) return;
  try { writeFileSync(placeCacheFile(dataId), JSON.stringify(place)); } catch { /* no-op */ }
}

async function apiSearch(q: string, lat: number, lng: number): Promise<PisoSearchItem[]> {
  const r = await withRetry(
    () => axios.get<{ local_result?: PisoSearchItem[] }>(`${API_BASE}/search`, {
      params: { q, lat, lng }, headers: { 'x-api-key': API_KEY }, timeout: 30000,
    }), 'search');
  return r.data?.local_result ?? [];
}
async function apiPlace(dataId: string, lat: number, lng: number): Promise<PisoPlace | null> {
  const cached = readPlaceCache(dataId);
  if (cached) return cached;
  const r = await withRetry(
    () => axios.get<{ place_result?: PisoPlace }>(`${API_BASE}/place`, {
      params: { data_id: dataId, lat, lng }, headers: { 'x-api-key': API_KEY }, timeout: 30000,
    }), 'place');
  const place = r.data?.place_result ?? null;
  if (place) writePlaceCache(dataId, place);
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

async function main(): Promise<void> {
  if (!API_KEY) throw new Error('PISOMAP_API_KEY required');
  if (FLAGS.apply && (!BACKEND || !ADMIN_JWT))
    throw new Error('BACKEND_PUBLIC_URL + IMPORT_ADMIN_JWT required for --apply');

  ensureCacheDirs();
  log(`▶ START ${FLAGS.apply ? '🔴 APPLY' : '🟡 DRY-RUN'} city=${FLAGS.city || 'all'} limit=${FLAGS.limit || 'none'}`);
  log(`  gate: rating > ${FLAGS.minRating}, reviews > ${FLAGS.minReviews}, real images >= ${FLAGS.minImages}`);
  log(`  log file: ${LOG_FILE}`);

  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const venueRepo = ds.getRepository(Venue);

  // Pre-load wards for re-resolution after refresh.
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

  // The query: all-Unsplash means every image URL starts with images.unsplash.com.
  // NOT EXISTS (any URL that doesn't) — this also requires at least 1 image.
  const cityFilter = FLAGS.city ? `AND c.slug = '${FLAGS.city.replace(/'/g, '')}'` : '';
  const limitSql = FLAGS.limit > 0 ? `LIMIT ${FLAGS.limit}` : '';
  const venues: Array<{
    id: string; slug: string; name: string; city_slug: string;
    external_id: string | null; lat: number; lng: number;
    rating: string; external_review_count: number; source: string;
    ward_canonical: string | null; address: string;
  }> = await ds.query(`
    SELECT v.id, v.slug, v.name, c.slug AS city_slug,
           v.external_id, v.lat, v.lng,
           v.rating, v.external_review_count, v.source,
           v.ward_canonical, v.address
    FROM venues v JOIN cities c ON c.id = v.city_id
    WHERE v.deleted_at IS NULL AND v.is_published = true
      AND COALESCE(array_length(v.images, 1), 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM unnest(v.images) img
        WHERE img NOT LIKE 'https://images.unsplash.com/%'
      )
      ${cityFilter}
    ORDER BY v.external_review_count DESC NULLS LAST, v.name
    ${limitSql}`);

  log(`  ${venues.length} all-Unsplash venues to process\n`);
  if (venues.length === 0) { await ds.destroy(); return; }

  const reviewerCache = new Map<string, string>();
  let updated = 0, deleted = 0, failed = 0;
  let totalReviewPhotosSaved = 0;

  for (let i = 0; i < venues.length; i++) {
    const v = venues[i];
    log(`\n[${i + 1}/${venues.length}] ${v.city_slug} / ${v.name}  (source=${v.source}, has_ext_id=${!!v.external_id})`);
    log(`  current: ${v.rating}★ ${v.external_review_count} reviews, ward=${v.ward_canonical ?? 'NULL'}`);

    try {
      // Step 1: refresh from PISO.
      let place: PisoPlace | null = null;
      let matched: PisoSearchItem | null = null;
      let placeGone = false;

      if (v.external_id) {
        try { place = await apiPlace(v.external_id, v.lat, v.lng); if (place) matched = place; }
        catch (e) {
          const s = axios.isAxiosError(e) ? e.response?.status : undefined;
          if (String(e).includes('404') || s === 404) { placeGone = true; log(`  ⤷ PISO 404 — Google delisted`); }
          else throw e;
        }
      } else {
        log(`  ⤷ no external_id — searching PISO by name+coords`);
        const results = await apiSearch(v.name, v.lat, v.lng);
        await sleep(FLAGS.apiDelay);
        matched = results[0] ?? null;
        if (matched?.data_id) {
          try {
            place = await apiPlace(matched.data_id, v.lat, v.lng);
            await sleep(FLAGS.apiDelay);
          } catch (e) {
            const s = axios.isAxiosError(e) ? e.response?.status : undefined;
            if (String(e).includes('404') || s === 404) { placeGone = true; matched = null; log(`  ⤷ search match 404'd on detail`); }
            else throw e;
          }
        }
      }

      if (!matched || !place) {
        log(`  ✗ ${placeGone ? 'PISO 404' : 'no PISO match'} → DELETE`);
        if (FLAGS.apply) await venueRepo.softDelete({ id: v.id });
        deleted++;
        continue;
      }

      // Dedupe: if PISO matched this curated venue to a place_id that's
      // already in the DB (under another slug), the curated row is a
      // duplicate. Soft-delete the curated row and skip — the existing
      // Google import already has real photos.
      const matchedDataId = matched.data_id;
      if (matchedDataId && matchedDataId !== v.external_id) {
        const dup = await venueRepo.findOne({
          where: { externalId: matchedDataId },
          select: { id: true, slug: true },
        });
        if (dup) {
          log(`  ✗ PISO matched a place already imported as "${dup.slug}" — soft-deleting this duplicate`);
          if (FLAGS.apply) await venueRepo.softDelete({ id: v.id });
          deleted++;
          continue;
        }
      }

      const newRating = matched.rating ?? place.rating ?? 0;
      const newReviews = matched.reviews ?? place.reviews ?? 0;
      const mediaUrls = flatMedia(place);
      log(`  fresh: ${newRating}★ ${newReviews} reviews, ${mediaUrls.length} img candidates`);

      // Quality gate (strict: STRICTLY greater than)
      const failsRating = newRating <= FLAGS.minRating;
      const failsReviews = newReviews <= FLAGS.minReviews;
      const failsImgPool = mediaUrls.length < FLAGS.minImages;
      if (failsRating || failsReviews || failsImgPool) {
        const why = [
          failsRating && `rating ${newRating}<=${FLAGS.minRating}`,
          failsReviews && `reviews ${newReviews}<=${FLAGS.minReviews}`,
          failsImgPool && `img candidates ${mediaUrls.length}<${FLAGS.minImages}`,
        ].filter(Boolean).join(', ');
        log(`  ✗ fails gate (${why}) → DELETE`);
        if (FLAGS.apply) await venueRepo.softDelete({ id: v.id });
        deleted++;
        continue;
      }

      // Step 2: upload real images. Need at least --min-images successes.
      log(`  ✓ passes gate — uploading images…`);
      const newImages: string[] = [];
      if (FLAGS.apply) {
        for (const u of mediaUrls.slice(0, FLAGS.photos * 3)) {
          if (newImages.length >= FLAGS.photos) break;
          try {
            newImages.push(await uploadImage(u));
          } catch (e) {
            log(`    img failed: ${String(e).slice(0, 100)}`);
          }
          await sleep(FLAGS.uploadDelay);
        }
        if (newImages.length < FLAGS.minImages) {
          log(`  ✗ only ${newImages.length}/${FLAGS.minImages} uploads succeeded → DELETE`);
          await venueRepo.softDelete({ id: v.id });
          deleted++;
          continue;
        }
      } else {
        log(`  [dry-run] would upload up to ${FLAGS.photos} images`);
      }

      // Step 3: pick reviews + extract photo URLs (Apify-style — save raw
      // lh3.googleusercontent.com URLs on review.photos[])
      const pickedReviews: PisoReview[] = [];
      const seenAuthor = new Set<string>();
      const candReviews = (place.review_list ?? [])
        .filter((r) => (r.text ?? '').trim().length >= 8 && (r.author_name ?? '').trim())
        .sort((a, b) =>
          ((b.photos?.length ?? 0) - (a.photos?.length ?? 0)) || // prefer reviews with photos
          ((b.rating ?? 0) - (a.rating ?? 0)) ||
          ((b.text ?? '').length - (a.text ?? '').length));
      for (const r of candReviews) {
        const author = (r.author_name ?? '').trim();
        if (seenAuthor.has(author)) continue;
        seenAuthor.add(author);
        pickedReviews.push(r);
        if (pickedReviews.length >= FLAGS.reviews) break;
      }
      const reviewPhotoCount = pickedReviews.reduce((n, r) => n + (r.photos?.length ?? 0), 0);
      log(`  ${pickedReviews.length} reviews picked, ${reviewPhotoCount} reviewer-attached photos`);

      // Step 4: re-resolve ward from refreshed address
      const cityWards = wardsByCity.get(v.city_slug) ?? [];
      const newAddress = matched.location?.address?.full ?? place.location?.address?.full ?? v.address ?? '';
      const wardResolve: ResolveResult | null = resolveWardFromVenue(null, newAddress, cityWards);
      if (wardResolve) log(`  ⛳ ward: ${wardResolve.wardCanonical} (${wardResolve.method})`);
      else log(`  ⚠ ward still unresolved`);

      const newWebsite = (place.contacts?.website ?? matched.contacts?.website ?? '').trim();
      const newHours = compactHours(matched.opening_hours) || compactHours(place.opening_hours) || '';

      if (!FLAGS.apply) {
        log(`  [dry-run] would UPDATE rating/reviews/images/ward${reviewPhotoCount > 0 ? `/review-photos×${reviewPhotoCount}` : ''}`);
        updated++;
        continue;
      }

      // Step 5: transaction — replace existing reviews with the fresh 4
      // (including review photos), update venue.
      await ds.transaction(async (mgr) => {
        await mgr.delete(Review, { venueId: v.id });

        let sum = 0, inserted = 0;
        const usedUid = new Set<string>();
        let photosSaved = 0;
        for (const r of pickedReviews) {
          const uid = await getOrCreateReviewer(mgr, r.author_name ?? '', r.author_profile_pic ?? '', reviewerCache);
          if (usedUid.has(uid)) continue;
          usedUid.add(uid);
          const rating = Math.min(5, Math.max(1, Math.round(r.rating ?? 5)));
          const reviewPhotos = (r.photos ?? []).map((p) => p.url ?? '').filter(Boolean);
          await mgr.save(mgr.create(Review, {
            venueId: v.id,
            userId: uid,
            rating,
            body: (r.text ?? '').slice(0, 4000),
            photos: reviewPhotos,
          }));
          photosSaved += reviewPhotos.length;
          sum += rating;
          inserted++;
        }
        totalReviewPhotosSaved += photosSaved;

        // Blend Google avg with synthetic-user avg, same as ReviewsService
        const blended = inserted > 0
          ? (newRating * newReviews + (sum / inserted) * inserted) / (newReviews + inserted)
          : newRating;

        await mgr.update(Venue, { id: v.id }, {
          rating: Math.round(blended * 100) / 100,
          reviewCount: newReviews + inserted,
          externalRating: newRating,
          externalReviewCount: newReviews,
          externalId: matched.data_id ?? v.external_id,
          images: newImages,
          ...(newAddress ? { address: newAddress.slice(0, 240) } : {}),
          ...(newWebsite && /^https?:\/\//i.test(newWebsite) ? { website: newWebsite.slice(0, 500) } : {}),
          ...(newHours ? { hours: newHours } : {}),
          ...(wardResolve ? {
            wardCanonical: wardResolve.wardCanonical,
            wardType: wardResolve.wardType,
            wardResolutionMethod: wardResolve.method,
          } : {}),
          externalOpeningHours: matched.opening_hours ?? place.opening_hours ?? null,
          // Full external_raw — apify-shaped so FE renders amenities
          // (features → additionalInfo) and review photos (review_list →
          // reviews[].reviewImageUrls) without any FE code changes.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          externalRaw: buildExternalRaw(place, pickedReviews) as any,
          externalSyncedAt: new Date(),
          // Promote curated rows that just got real PISO data to source='google'
          source: 'google',
        });
      });
      updated++;
      log(`  ✓ UPDATED — ${newImages.length} imgs, ${pickedReviews.length} reviews (+${reviewPhotoCount} review photos)`);
    } catch (e) {
      failed++;
      log(`  ✗ FAILED: ${String(e).slice(0, 200)}`);
    }
    await sleep(FLAGS.apiDelay);
  }

  log(`\n▶ DONE`);
  log(`  updated=${updated}  deleted=${deleted}  failed=${failed}  review-photos-saved=${totalReviewPhotosSaved}`);
  log(`  log: ${LOG_FILE}`);
  if (!FLAGS.apply) log(`  (dry-run — pass --apply to actually mutate)`);
  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
