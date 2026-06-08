import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, statSync } from 'fs';
import { resolve } from 'path';
import axios from 'axios';
import { DataSource, EntityManager } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue, User, Review } from './entities';
import { buildExternalRaw } from './piso-to-external-raw';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Retro-fill PISO extras (additionalInfo + reviews with photos) onto venues
// that were imported BEFORE we started writing those fields. Targets rows
// where:
//   - external_id IS NOT NULL                (PISO knows the place)
//   - AND external_raw is missing additionalInfo OR reviews             OR
//       Review.photos all empty for this venue
//
// NO image re-upload, NO ward re-resolve — those already exist on the row.
// This script only refreshes the JSONB blob + Review.photos for FE rendering.
//
// Cache: reuses import-pisomap-cache/place/, so re-runs are basically free.
//
//   npx ts-node src/database/_diag-piso-backfill-extras.ts                 (dry-run)
//   npx ts-node src/database/_diag-piso-backfill-extras.ts --apply
//   npx ts-node src/database/_diag-piso-backfill-extras.ts --city=da-nang --apply
//   npx ts-node src/database/_diag-piso-backfill-extras.ts --limit=5 --dry-run
// ─────────────────────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const FLAGS = {
  city: arg('city', ''),
  limit: parseInt(arg('limit', '0'), 10),
  reviews: parseInt(arg('reviews', '4'), 10),
  apiDelay: parseInt(arg('api-delay', '500'), 10),
  cacheTtlDays: parseInt(arg('cache-ttl-days', '30'), 10),
  noCache: process.argv.includes('--no-cache'),
  apply: process.argv.includes('--apply'),
};

const API_KEY = process.env.PISOMAP_API_KEY ?? '';
const API_BASE = 'https://api.pisomap.tech/api/maps';
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const LOG_FILE = resolve(process.cwd(), `piso-backfill-extras-${FLAGS.city || 'all'}-${RUN_ID}.log`);

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
interface PisoReview {
  review_id?: string; author_name?: string; author_profile_pic?: string;
  rating?: number; relative_date?: string; text?: string; photos?: PisoMedia[];
}
interface PisoPlace {
  data_id?: string; place_id?: string; type?: string; description?: string;
  contacts?: { phone?: string; website?: string };
  features?: Record<string, string[]>;
  review_list?: PisoReview[];
  google_maps_url?: string;
  rating?: number; reviews?: number;
  location?: { latitude?: number; longitude?: number; address?: { full?: string } };
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
  ensureCacheDirs();

  log(`▶ START ${FLAGS.apply ? '🔴 APPLY' : '🟡 DRY-RUN'} city=${FLAGS.city || 'all'} limit=${FLAGS.limit || 'none'}`);
  log(`  log file: ${LOG_FILE}`);

  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const venueRepo = ds.getRepository(Venue);

  // Selector: venues whose external_raw is missing either additionalInfo or
  // reviews — that's the failure mode all pre-2026-06-08 PISO imports hit.
  // Curated rows without external_id can't be backfilled (no provider link)
  // — they're excluded here; use _diag-unsplash-cleanup.ts for those.
  const cityFilter = FLAGS.city ? `AND c.slug = '${FLAGS.city.replace(/'/g, '')}'` : '';
  const limitSql = FLAGS.limit > 0 ? `LIMIT ${FLAGS.limit}` : '';
  const venues: Array<{
    id: string; slug: string; name: string; city_slug: string;
    external_id: string; lat: number; lng: number;
    has_addinfo: boolean; has_reviews: boolean;
  }> = await ds.query(`
    SELECT v.id, v.slug, v.name, c.slug AS city_slug,
           v.external_id, v.lat, v.lng,
           (v.external_raw ? 'additionalInfo') AS has_addinfo,
           (v.external_raw ? 'reviews') AS has_reviews
    FROM venues v JOIN cities c ON c.id = v.city_id
    WHERE v.deleted_at IS NULL
      AND v.external_id IS NOT NULL
      AND (
        v.external_raw IS NULL
        OR NOT (v.external_raw ? 'additionalInfo')
        OR NOT (v.external_raw ? 'reviews')
      )
      ${cityFilter}
    ORDER BY v.external_review_count DESC NULLS LAST
    ${limitSql}`);

  log(`  ${venues.length} venues need backfill\n`);
  if (venues.length === 0) { await ds.destroy(); return; }

  const reviewerCache = new Map<string, string>();
  let updated = 0, failed = 0, noPlace = 0;
  let totalReviewPhotosSaved = 0;
  let totalAmenityGroups = 0;

  for (let i = 0; i < venues.length; i++) {
    const v = venues[i];
    log(`[${i + 1}/${venues.length}] ${v.city_slug} / ${v.name}  (addInfo=${v.has_addinfo}, reviews=${v.has_reviews})`);

    try {
      const place = await apiPlace(v.external_id, v.lat, v.lng);
      if (!place) {
        log(`  ✗ no place data — skip`);
        noPlace++;
        continue;
      }

      // Pick top N reviews — same selection logic as the importers
      const picked: PisoReview[] = [];
      const seenAuthor = new Set<string>();
      const sortedCandidates = (place.review_list ?? [])
        .filter((r) => (r.text ?? '').trim().length >= 8 && (r.author_name ?? '').trim())
        .sort((a, b) =>
          ((b.photos?.length ?? 0) - (a.photos?.length ?? 0)) ||
          ((b.rating ?? 0) - (a.rating ?? 0)) ||
          ((b.text ?? '').length - (a.text ?? '').length));
      for (const r of sortedCandidates) {
        const author = (r.author_name ?? '').trim();
        if (seenAuthor.has(author)) continue;
        seenAuthor.add(author);
        picked.push(r);
        if (picked.length >= FLAGS.reviews) break;
      }

      const newRaw = buildExternalRaw(place, picked);
      const amenityGroups = newRaw.additionalInfo
        ? Object.keys(newRaw.additionalInfo as Record<string, unknown>).length : 0;
      const reviewPhotoCount = picked.reduce((n, r) => n + (r.photos?.length ?? 0), 0);
      log(`  fresh: ${amenityGroups} amenity groups, ${picked.length} reviews (+${reviewPhotoCount} review photos)`);

      if (!FLAGS.apply) {
        log(`  [dry-run] would UPDATE external_raw + Review.photos`);
        updated++;
        totalAmenityGroups += amenityGroups;
        totalReviewPhotosSaved += reviewPhotoCount;
        continue;
      }

      // Write back: external_raw + per-review photos. We DON'T re-insert
      // reviews from scratch — that would duplicate or fail the unique
      // (user, venue) constraint. Instead, for each picked review match
      // by reviewer handle and just update photos[].
      await ds.transaction(async (mgr) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await mgr.update(Venue, { id: v.id }, { externalRaw: newRaw as any });

        let photosWritten = 0;
        for (const r of picked) {
          const uid = await getOrCreateReviewer(mgr, r.author_name ?? '', r.author_profile_pic ?? '', reviewerCache);
          const photos = (r.photos ?? []).map((p) => p.url ?? '').filter(Boolean);
          if (photos.length === 0) continue;
          // Upsert by (userId, venueId) — uq_review_user_venue constraint.
          // If the row exists from an earlier import, set photos; if not,
          // insert a fresh review with the text + photos (best-effort
          // backfill — text comes from the PISO snapshot).
          const existing = await mgr.findOne(Review, {
            where: { userId: uid, venueId: v.id },
            select: { id: true },
          });
          if (existing) {
            await mgr.update(Review, { id: existing.id }, { photos });
          } else {
            const rating = Math.min(5, Math.max(1, Math.round(r.rating ?? 5)));
            try {
              await mgr.save(mgr.create(Review, {
                venueId: v.id, userId: uid, rating,
                body: (r.text ?? '').slice(0, 4000), photos,
              }));
            } catch (e) {
              log(`    review insert failed for ${r.author_name}: ${String(e).slice(0, 80)}`);
              continue;
            }
          }
          photosWritten += photos.length;
        }
        totalReviewPhotosSaved += photosWritten;
        totalAmenityGroups += amenityGroups;
      });
      updated++;
      log(`  ✓ UPDATED`);
    } catch (e) {
      failed++;
      log(`  ✗ FAILED: ${String(e).slice(0, 200)}`);
    }
  }

  log(`\n▶ DONE`);
  log(`  updated=${updated}  no-place=${noPlace}  failed=${failed}`);
  log(`  totals: ${totalAmenityGroups} amenity groups written, ${totalReviewPhotosSaved} review photos saved`);
  log(`  log: ${LOG_FILE}`);
  if (!FLAGS.apply) log(`  (dry-run — pass --apply to actually mutate)`);
  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
