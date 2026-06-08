import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue, Ward } from './entities';
import {
  resolveWardFromVenue,
  toNormalizable,
  type NormalizableWard,
  type ResolveResult,
} from '../modules/venues/ward-resolver';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Quality verify + fix.
//
// Step 1: SELECT venues failing any of:
//           - external_review_count <= --min-reviews
//           - rating <= --min-rating
//           - images empty OR all from images.unsplash.com
//           - ward_canonical IS NULL
//
// Step 2: For each, re-query PISO using the stored external_id (or
//         name+lat+lng if external_id is missing). Re-check against the
//         SAME quality gate the discover importer enforces:
//           - rating > min-rating
//           - reviews > min-reviews
//           - >= min-images real photos uploadable to our CDN
//
// Step 3: If new data passes → UPDATE the venue (rating, reviews, images,
//         ward, externalRaw, hours). If still fails → SOFT-DELETE.
//
// Curated venues (source='curated') are excluded by default — they're hand-
// seeded and may legitimately have low metrics while the community catches
// up. Use --include-curated to override.
//
// SAFETY: dry-run by default. Pass --apply to actually mutate. Reuses the
// PISO cache from import-pisomap-discover.ts so re-runs are cheap.
//
//   npx ts-node src/database/_diag-venue-quality-verify.ts                  (dry-run, all cities)
//   npx ts-node src/database/_diag-venue-quality-verify.ts --apply
//   npx ts-node src/database/_diag-venue-quality-verify.ts --city=hue --apply
//   npx ts-node src/database/_diag-venue-quality-verify.ts --limit=20 --dry-run
// ─────────────────────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const FLAGS = {
  city: arg('city', ''),
  limit: parseInt(arg('limit', '0'), 10),
  minRating: parseFloat(arg('min-rating', '4.0')),
  // Default 30 — matches the relaxed bar the operator set during the
  // 2026-06 cleanup. Override per-run with --min-reviews=N when seeking
  // a stricter sweep.
  minReviews: parseInt(arg('min-reviews', '30'), 10),
  minImages: parseInt(arg('min-images', '5'), 10),
  photos: parseInt(arg('photos', '5'), 10),
  uploadDelay: parseInt(arg('upload-delay', '300'), 10),
  apiDelay: parseInt(arg('api-delay', '500'), 10),
  cacheTtlDays: parseInt(arg('cache-ttl-days', '7'), 10), // shorter than discover; fresher
  noCache: process.argv.includes('--no-cache'),
  // Default true now — the 2026-06 landmark seed batch left curated venues
  // with all-Unsplash images, which is the very leak this script is for.
  // Use --exclude-curated to skip them.
  includeCurated: !process.argv.includes('--exclude-curated'),
  apply: process.argv.includes('--apply'),
};

const API_KEY = process.env.PISOMAP_API_KEY ?? '';
const API_BASE = 'https://api.pisomap.tech/api/maps';
const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const ADMIN_JWT = process.env.IMPORT_ADMIN_JWT ?? '';

const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const LOG_FILE = resolve(process.cwd(), `verify-${FLAGS.city || 'all'}-${RUN_ID}.log`);
const CACHE_DIR = resolve(process.cwd(), 'import-pisomap-cache');
const CACHE_PLACE_DIR = resolve(CACHE_DIR, 'place');

function ensureCacheDirs(): void {
  if (FLAGS.noCache) return;
  for (const d of [CACHE_DIR, CACHE_PLACE_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

function log(line: string): void {
  const stamped = `[${new Date().toISOString().slice(11, 19)}] ${line}`;
  console.log(stamped);
  try { appendFileSync(LOG_FILE, stamped + '\n'); } catch { /* no-op */ }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
interface PisoPlace extends PisoSearchItem {
  description?: string;
  photos?: { category_id?: string; media?: PisoMedia[] }[];
  google_maps_url?: string;
}

function readPlaceCache(dataId: string): PisoPlace | null {
  if (FLAGS.noCache) return null;
  const file = resolve(CACHE_PLACE_DIR, `${dataId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  if (!existsSync(file)) return null;
  try {
    const ageMs = Date.now() - statSync(file).mtimeMs;
    if (ageMs > FLAGS.cacheTtlDays * 86400 * 1000) return null;
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch { return null; }
}
function writePlaceCache(dataId: string, place: PisoPlace): void {
  if (FLAGS.noCache) return;
  const file = resolve(CACHE_PLACE_DIR, `${dataId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  try { writeFileSync(file, JSON.stringify(place)); } catch { /* best-effort */ }
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

async function apiSearch(q: string, lat: number, lng: number): Promise<PisoSearchItem[]> {
  const r = await withRetry(
    () => axios.get<{ local_result?: PisoSearchItem[] }>(`${API_BASE}/search`, {
      params: { q, lat, lng }, headers: { 'x-api-key': API_KEY }, timeout: 30000,
    }), 'search');
  return r.data?.local_result ?? [];
}

function flatMedia(p: PisoPlace): string[] {
  const urls: string[] = [];
  for (const g of p.photos ?? []) for (const m of g.media ?? []) if (m.url) urls.push(m.url);
  return urls;
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

async function main(): Promise<void> {
  if (!API_KEY) throw new Error('PISOMAP_API_KEY required');
  if (FLAGS.apply && (!BACKEND || !ADMIN_JWT))
    throw new Error('BACKEND_PUBLIC_URL + IMPORT_ADMIN_JWT required for --apply');

  ensureCacheDirs();
  log(`▶ START ${FLAGS.apply ? '🔴 APPLY' : '🟡 DRY-RUN'} city=${FLAGS.city || 'all'} limit=${FLAGS.limit || 'none'}`);
  log(`  filters: rating>${FLAGS.minRating}, reviews>${FLAGS.minReviews}, images>=${FLAGS.minImages}`);
  log(`  scope: ${FLAGS.includeCurated ? 'INCLUDE curated' : 'exclude curated'}`);
  log(`  log file: ${LOG_FILE}`);

  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const venueRepo = ds.getRepository(Venue);

  // Pre-load wards for ward re-resolution after PISO refresh.
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

  // Query failing venues. Same predicate as the audit script.
  const conds: string[] = [`v.deleted_at IS NULL`, `v.is_published = true`];
  if (!FLAGS.includeCurated) conds.push(`v.source <> 'curated'`);
  if (FLAGS.city) conds.push(`c.slug = '${FLAGS.city.replace(/'/g, '')}'`);
  const failingPredicate = `(
    COALESCE(v.external_review_count, 0) <= ${FLAGS.minReviews}
    OR COALESCE(v.rating, 0) <= ${FLAGS.minRating}
    OR COALESCE(array_length(v.images, 1), 0) = 0
    OR (
      COALESCE(array_length(v.images, 1), 0) > 0
      AND NOT EXISTS (SELECT 1 FROM unnest(v.images) i WHERE i NOT LIKE 'https://images.unsplash.com/%')
    )
    OR v.ward_canonical IS NULL
  )`;
  const limitSql = FLAGS.limit > 0 ? `LIMIT ${FLAGS.limit}` : '';
  const venues: Array<{
    id: string; slug: string; name: string; city_slug: string;
    external_id: string | null; lat: number; lng: number;
    rating: string; external_review_count: number;
    images: string[]; ward_canonical: string | null;
    source: string;
  }> = await ds.query(`
    SELECT v.id, v.slug, v.name, c.slug AS city_slug,
           v.external_id, v.lat, v.lng,
           v.rating, v.external_review_count, v.images, v.ward_canonical,
           v.source
    FROM venues v JOIN cities c ON c.id = v.city_id
    WHERE ${conds.join(' AND ')} AND ${failingPredicate}
    ORDER BY v.external_review_count DESC NULLS LAST
    ${limitSql}`);

  log(`  ${venues.length} venues to verify`);
  if (venues.length === 0) { await ds.destroy(); return; }

  let updated = 0, deleted = 0, skippedNoExtId = 0, keptCurated = 0, failed = 0;

  for (let i = 0; i < venues.length; i++) {
    const v = venues[i];
    log(`\n[${i + 1}/${venues.length}] ${v.city_slug} / ${v.name}`);
    log(`  current: ${v.rating}★ ${v.external_review_count} reviews, ${v.images?.length ?? 0} imgs, ward=${v.ward_canonical ?? 'NULL'}`);

    try {
      // Step 1: refresh from PISO. Prefer external_id; if missing, search.
      let place: PisoPlace | null = null;
      let matched: PisoSearchItem | null = null;
      let placeGone = false; // 404 from PISO = Google removed the place
      if (v.external_id) {
        try {
          place = await apiPlace(v.external_id, v.lat, v.lng);
          if (place) matched = place;
        } catch (e) {
          // 404 means Google delisted the place. Treat as "doesn't exist
          // anymore" → fall through to the deletion path. Other errors
          // (network, 5xx) still throw and land in the outer catch.
          const status = axios.isAxiosError(e) ? e.response?.status : undefined;
          if (String(e).includes('status code 404') || status === 404) {
            placeGone = true;
            log(`  ⤷ PISO returned 404 — place no longer exists on Google`);
          } else {
            throw e;
          }
        }
      } else {
        skippedNoExtId++;
        log(`  ⤷ no external_id — running fresh search`);
        const results = await apiSearch(v.name, v.lat, v.lng);
        matched = results[0] ?? null;
        await sleep(FLAGS.apiDelay);
        if (matched?.data_id) {
          try {
            place = await apiPlace(matched.data_id, v.lat, v.lng);
          } catch (e) {
            const status = axios.isAxiosError(e) ? e.response?.status : undefined;
            if (String(e).includes('status code 404') || status === 404) {
              placeGone = true;
              matched = null;
              log(`  ⤷ search match 404'd on detail fetch — treating as gone`);
            } else {
              throw e;
            }
          }
          await sleep(FLAGS.apiDelay);
        }
      }

      if (!matched || !place) {
        // SAFETY: never auto-delete hand-curated landmarks just because PISO
        // doesn't know about them (e.g. "Đồi Thiên Phúc Đức cây cô đơn" —
        // a real Đà Lạt viewpoint but too obscure for Google to surface).
        // Leave them as-is with whatever images they have; an admin can
        // upload real photos via the admin UI later.
        //
        // EXCEPTION: a 404 on a venue that originally HAD an external_id
        // means Google delisted the place — even if it's marked curated
        // (which only happened by mistake during the 2026-06 import). Those
        // get deleted too because their existence is gone from the world.
        if (v.source === 'curated' && !placeGone) {
          log(`  ⊙ curated venue with no PISO match → KEEP (needs manual image upload)`);
          keptCurated++;
          continue;
        }
        log(`  ✗ ${placeGone ? '404 from PISO (place delisted)' : 'no PISO data for refresh'} → DELETE`);
        if (FLAGS.apply) await venueRepo.softDelete({ id: v.id });
        deleted++;
        continue;
      }

      const newRating = matched.rating ?? place.rating ?? 0;
      const newReviews = matched.reviews ?? place.reviews ?? 0;
      const mediaUrls = flatMedia(place);
      log(`  fresh: ${newRating}★ ${newReviews} reviews, ${mediaUrls.length} img candidates`);

      // Quality gate
      const failsRating = newRating <= FLAGS.minRating;
      const failsReviews = newReviews <= FLAGS.minReviews;
      const failsImgPool = mediaUrls.length < FLAGS.minImages;

      if (failsRating || failsReviews || failsImgPool) {
        const why = [
          failsRating && `rating ${newRating}<=${FLAGS.minRating}`,
          failsReviews && `reviews ${newReviews}<=${FLAGS.minReviews}`,
          failsImgPool && `imgs ${mediaUrls.length}<${FLAGS.minImages}`,
        ].filter(Boolean).join(', ');
        // SAFETY: same as above — curated landmarks survive a failing gate.
        // The whole point of the curated tier is "we believe this exists
        // even when third-party data is thin".
        if (v.source === 'curated') {
          log(`  ⊙ curated venue fails refresh (${why}) → KEEP (needs manual review)`);
          keptCurated++;
          continue;
        }
        log(`  ✗ still fails (${why}) → DELETE`);
        if (FLAGS.apply) await venueRepo.softDelete({ id: v.id });
        deleted++;
        continue;
      }

      // Passes — upload fresh images
      log(`  ✓ passes refresh — uploading images…`);
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
          if (v.source === 'curated') {
            log(`  ⊙ curated venue, only ${newImages.length} uploads succeeded → KEEP existing`);
            keptCurated++;
            continue;
          }
          log(`  ✗ only ${newImages.length} uploads succeeded → DELETE`);
          await venueRepo.softDelete({ id: v.id });
          deleted++;
          continue;
        }
      } else {
        // dry-run: pretend N images would upload
        log(`  [dry-run] would upload up to ${FLAGS.photos} images`);
      }

      // Re-resolve ward from refreshed address
      const cityWards = wardsByCity.get(v.city_slug) ?? [];
      const address = matched.location?.address?.full ?? '';
      const wardResolve: ResolveResult | null = resolveWardFromVenue(null, address, cityWards);
      if (wardResolve) {
        log(`  ⛳ ward: ${wardResolve.wardCanonical} (${wardResolve.method})`);
      } else if (v.ward_canonical) {
        log(`  ⛳ ward: kept existing ${v.ward_canonical}`);
      } else {
        log(`  ⚠ ward still unresolved`);
      }

      if (FLAGS.apply) {
        await venueRepo.update({ id: v.id }, {
          rating: newRating,
          reviewCount: newReviews,
          externalRating: newRating,
          externalReviewCount: newReviews,
          images: newImages,
          ...(address ? { address: address.slice(0, 240) } : {}),
          ...(wardResolve ? {
            wardCanonical: wardResolve.wardCanonical,
            wardType: wardResolve.wardType,
            wardResolutionMethod: wardResolve.method,
          } : {}),
          externalSyncedAt: new Date(),
        });
        log(`  ✓ UPDATED`);
      } else {
        log(`  [dry-run] would UPDATE rating/reviews/images/ward`);
      }
      updated++;
    } catch (e) {
      failed++;
      log(`  ✗ FAILED: ${String(e).slice(0, 200)}`);
    }
    await sleep(FLAGS.apiDelay);
  }

  log(`\n▶ DONE`);
  log(`  updated=${updated}  deleted=${deleted}  failed=${failed}  no-ext-id=${skippedNoExtId}  kept-curated=${keptCurated}`);
  log(`  log: ${LOG_FILE}`);
  if (!FLAGS.apply) log(`  (dry-run — pass --apply to actually mutate)`);
  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
