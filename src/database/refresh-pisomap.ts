import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import axios from 'axios';
import sharp from 'sharp';
import { DataSource, EntityManager } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { dataSourceOptions } from './data-source';
import { Venue, User, Review } from './entities';
import { buildExternalRaw } from './piso-to-external-raw';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// PISO Maps → REFRESH existing venues (vs import-pisomap.ts which only inserts).
//
// Targets venues that already exist in the DB but have poor data — by default:
// rating < 4.0, external_review_count = 0, and every image is an unsplash URL.
// For each match: PISO search by venue.name + venue.lat/lng → place detail →
// upload photos → attach Google reviews → UPDATE the venue row in place.
// Preserves: upvotes, saves, real (non-synthetic) reviews, curated fields
// (name/category/district/tags/priceRange/description).
//
// USAGE
//   npm run refresh:pisomap -- --dry-run             (preview built-in query)
//   npm run refresh:pisomap -- --limit=5             (refresh first 5)
//   npm run refresh:pisomap -- --slugs=foo,bar       (explicit list)
//   npm run refresh:pisomap -- --city=ninh-binh      (filter built-in query)
//
// FLAGS  --slugs=a,b,c --city=<slug> --limit=<n> --photos=5 --reviews=4
//        --api-delay=500 --upload-delay=300 --dry-run
// ENV    PISOMAP_API_KEY, BACKEND_PUBLIC_URL, IMPORT_ADMIN_JWT, DATABASE_URL
// ─────────────────────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const FLAGS = {
  slugs: arg('slugs', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  onlyCity: arg('city', ''),
  limit: parseInt(arg('limit', '0'), 10),
  photos: parseInt(arg('photos', '5'), 10),
  reviews: parseInt(arg('reviews', '4'), 10),
  uploadDelay: parseInt(arg('upload-delay', '300'), 10),
  apiDelay: parseInt(arg('api-delay', '500'), 10),
  dryRun: process.argv.includes('--dry-run'),
};

const API_KEY = process.env.PISOMAP_API_KEY ?? '';
const API_BASE = 'https://api.pisomap.tech/api/maps';
const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const ADMIN_JWT = process.env.IMPORT_ADMIN_JWT ?? '';
const CHECKPOINT = resolve(process.cwd(), 'refresh-pisomap-progress.json');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function nameSim(a: string, b: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  const A = new Set(norm(a));
  const B = new Set(norm(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

function haversineKm(
  la1: number,
  lo1: number,
  la2: number,
  lo2: number,
): number {
  const R = 6371,
    d = Math.PI / 180;
  const dla = (la2 - la1) * d,
    dlo = (lo2 - lo1) * d;
  const x =
    Math.sin(dla / 2) ** 2 +
    Math.cos(la1 * d) * Math.cos(la2 * d) * Math.sin(dlo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  tries = 5,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const s = axios.isAxiosError(e) ? e.response?.status : undefined;
      if (s && s < 500 && s !== 429) break;
      await sleep(s === 429 ? 15000 : 1000 * (i + 1));
    }
  }
  throw new Error(`${label} failed: ${String(last)}`);
}

interface PisoSearchItem {
  data_id?: string;
  place_id?: string;
  title?: string;
  type?: string;
  rating?: number;
  reviews?: number;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: { full?: string };
  };
  opening_hours?: { day: string; hours: string }[];
  contacts?: { phone?: string; website?: string };
}
interface PisoMedia {
  id?: string;
  url?: string;
  width?: number;
  height?: number;
}
interface PisoReview {
  review_id?: string;
  author_name?: string;
  author_profile_pic?: string;
  rating?: number;
  relative_date?: string;
  text?: string;
  photos?: PisoMedia[];
}
interface PisoPlace extends PisoSearchItem {
  description?: string;
  photos?: { category_id?: string; media?: PisoMedia[] }[];
  review_list?: PisoReview[];
  google_maps_url?: string;
}

async function apiSearch(
  q: string,
  lat: number,
  lng: number,
): Promise<PisoSearchItem[]> {
  const r = await withRetry(
    () =>
      axios.get<{ local_result?: PisoSearchItem[] }>(`${API_BASE}/search`, {
        params: { q, lat, lng },
        headers: { 'x-api-key': API_KEY },
        timeout: 30000,
      }),
    'search',
  );
  return r.data?.local_result ?? [];
}
async function apiPlace(
  dataId: string,
  lat: number,
  lng: number,
): Promise<PisoPlace | null> {
  const r = await withRetry(
    () =>
      axios.get<{ place_result?: PisoPlace }>(`${API_BASE}/place`, {
        params: { data_id: dataId, lat, lng },
        headers: { 'x-api-key': API_KEY },
        timeout: 30000,
      }),
    'place',
  );
  return r.data?.place_result ?? null;
}

function flatMedia(p: PisoPlace): string[] {
  const urls: string[] = [];
  for (const g of p.photos ?? [])
    for (const m of g.media ?? []) if (m.url) urls.push(m.url);
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
    () =>
      axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
      }),
    'download image',
    3,
  );
  const webp = await sharp(Buffer.from(img.data))
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const up = await withRetry(
    () => {
      const fd = new FormData();
      fd.append(
        'file',
        new Blob([new Uint8Array(webp)], { type: 'image/webp' }),
        'g.webp',
      );
      return axios.post<{ data?: { url?: string }; url?: string }>(
        `${BACKEND}/admin/uploads`,
        fd,
        {
          headers: { Authorization: `Bearer ${ADMIN_JWT}` },
          maxBodyLength: Infinity,
          timeout: 30000,
        },
      );
    },
    'upload',
    6,
  );
  const out = up.data?.data?.url ?? up.data?.url;
  if (!out) throw new Error('upload returned no url');
  return out;
}

async function getOrCreateReviewer(
  m: EntityManager,
  authorName: string,
  avatar: string,
  cache: Map<string, string>,
): Promise<string> {
  const clean = (authorName || 'Khách Google').trim().slice(0, 60);
  const handle = ('g-' + slugify(clean)).slice(0, 40) || 'g-khach';
  if (cache.has(handle)) return cache.get(handle)!;
  let user = await m.findOne(User, { where: { handle } });
  if (!user) {
    user = await m.save(
      m.create(User, {
        handle,
        name: clean,
        role: 'user',
        isSynthetic: true,
        avatar: avatar || `https://picsum.photos/seed/${handle}/200/200`,
        bio: '',
        socials: {},
        bookingEnabled: false,
        checkInCount: 0,
        followerCount: 0,
      }),
    );
  }
  cache.set(handle, user.id);
  return user.id;
}

function blend(
  extRating: number,
  extCount: number,
  localAvg: number,
  localCount: number,
) {
  const combinedCount = localCount + extCount;
  const rating =
    combinedCount > 0
      ? (localAvg * localCount + extRating * extCount) / combinedCount
      : 0;
  return { rating: Math.round(rating * 100) / 100, reviewCount: combinedCount };
}

type Progress = Record<string, string>;
const loadProgress = (): Progress =>
  existsSync(CHECKPOINT)
    ? (JSON.parse(readFileSync(CHECKPOINT, 'utf8')) as Progress)
    : {};
const saveProgress = (p: Progress) =>
  writeFileSync(CHECKPOINT, JSON.stringify(p));

// Built-in target query: rating<4, 0 google reviews, every image is unsplash.
async function findTargetVenues(ds: DataSource): Promise<Venue[]> {
  if (FLAGS.slugs.length > 0) {
    return ds
      .getRepository(Venue)
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.city', 'c')
      .where('v.slug IN (:...slugs)', { slugs: FLAGS.slugs })
      .getMany();
  }
  const qb = ds
    .getRepository(Venue)
    .createQueryBuilder('v')
    .leftJoinAndSelect('v.city', 'c')
    .where('v.rating < 4.0')
    .andWhere('v.externalReviewCount = 0')
    .andWhere('COALESCE(array_length(v.images, 1), 0) > 0')
    .andWhere(
      `NOT EXISTS (
      SELECT 1 FROM unnest(v.images) AS img
      WHERE img NOT LIKE '%images.unsplash.com%'
    )`,
    )
    .orderBy('c.slug', 'ASC')
    .addOrderBy('v.slug', 'ASC');
  if (FLAGS.onlyCity) qb.andWhere('c.slug = :cs', { cs: FLAGS.onlyCity });
  return qb.getMany();
}

async function main(): Promise<void> {
  if (!API_KEY) throw new Error('PISOMAP_API_KEY required');
  if (!FLAGS.dryRun && (!BACKEND || !ADMIN_JWT))
    throw new Error(
      'BACKEND_PUBLIC_URL + IMPORT_ADMIN_JWT required (unless --dry-run)',
    );

  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const venueRepo = ds.getRepository(Venue);

  const targets = await findTargetVenues(ds);
  console.log(
    `\n▶ refresh-pisomap | candidates=${targets.length} | dry-run=${FLAGS.dryRun} | photos=${FLAGS.photos} reviews=${FLAGS.reviews}`,
  );
  if (targets.length === 0) {
    console.log('Nothing to do.');
    await ds.destroy();
    return;
  }

  const progress = loadProgress();
  const reviewerCache = new Map<string, string>();
  let updated = 0,
    skipped = 0,
    notMatched = 0,
    failed = 0;
  const total =
    FLAGS.limit > 0 ? Math.min(FLAGS.limit, targets.length) : targets.length;
  const startedAt = Date.now();

  for (let i = 0; i < targets.length; i++) {
    if (FLAGS.limit > 0 && updated >= FLAGS.limit) break;
    const v = targets[i];
    const tag = `[${i + 1}/${total}] ${v.city?.slug ?? '?'}/${v.slug}`;

    if (progress[v.slug] === 'saved') {
      skipped++;
      console.log(`${tag} ✓ already refreshed — skip`);
      continue;
    }

    const t0 = Date.now();
    try {
      // 1) PISO search using the venue's own name + coords
      const results = await apiSearch(v.name, v.lat, v.lng);
      await sleep(FLAGS.apiDelay);
      let best: PisoSearchItem | null = null,
        bestScore = 0;
      for (const r of results) {
        const sim = nameSim(v.name, r.title ?? '');
        const la = r.location?.latitude,
          lo = r.location?.longitude;
        const near =
          typeof la === 'number' && typeof lo === 'number'
            ? haversineKm(v.lat, v.lng, la, lo)
            : 999;
        if (near > 120) continue;
        const score = sim + (near < 5 ? 0.15 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = r;
        }
      }
      const matched = best && bestScore >= 0.45 ? best : null;

      if (!matched) {
        notMatched++;
        progress[v.slug] = 'not_matched';
        saveProgress(progress);
        console.log(
          `${tag} ? no PISO match (score=${bestScore.toFixed(2)}) — left untouched`,
        );
        continue;
      }

      // external_id uniqueness: another venue might already claim this Google place
      if (matched.data_id) {
        const dupExt = await venueRepo.findOne({
          where: { externalId: matched.data_id },
          select: { id: true, slug: true },
        });
        if (dupExt && dupExt.id !== v.id) {
          notMatched++;
          progress[v.slug] = 'dup_extid';
          saveProgress(progress);
          console.log(
            `${tag} ! data_id collides with "${dupExt.slug}" — left untouched`,
          );
          continue;
        }
      }

      // 2) place detail
      const place = matched.data_id
        ? await apiPlace(matched.data_id, v.lat, v.lng)
        : null;
      await sleep(FLAGS.apiDelay);

      const extRating = matched.rating ?? 0;
      const extReviews = matched.reviews ?? 0;
      const newAddress = (matched.location?.address?.full ?? v.address).slice(
        0,
        240,
      );
      const newHours = compactHours(matched.opening_hours) || v.hours;
      const newLat = matched.location?.latitude ?? v.lat;
      const newLng = matched.location?.longitude ?? v.lng;
      const mediaUrls = place ? flatMedia(place) : [];
      const candidateReviews = (place?.review_list ?? []).filter(
        (r) =>
          (r.text ?? '').trim().length >= 8 && (r.author_name ?? '').trim(),
      );

      if (FLAGS.dryRun) {
        console.log(
          `${tag} [dry] MATCH "${matched.title}" ${extRating}★/${extReviews} | imgs=${mediaUrls.length} reviews=${candidateReviews.length} @ ${newLat.toFixed(4)},${newLng.toFixed(4)} (${Date.now() - t0}ms)`,
        );
        updated++;
        continue;
      }

      // 3) upload photos
      const newImages: string[] = [];
      for (const u of mediaUrls.slice(0, FLAGS.photos * 3)) {
        if (newImages.length >= FLAGS.photos) break;
        try {
          newImages.push(await uploadImage(u));
        } catch (e) {
          console.warn(`  ${tag}   img failed: ${String(e)}`);
        }
        await sleep(FLAGS.uploadDelay);
      }
      // If PISO returned no usable photos, keep the existing unsplash array
      // (refusing to clear images is safer than blanking the venue).
      const imagesToWrite = newImages.length > 0 ? newImages : v.images;

      // 4) pick best reviews
      const picked: PisoReview[] = [];
      const seenAuthor = new Set<string>();
      const sortedCandidates = candidateReviews
        .slice()
        .sort(
          (a, b) =>
            (b.rating ?? 0) - (a.rating ?? 0) ||
            (b.text ?? '').length - (a.text ?? '').length,
        );
      for (const r of sortedCandidates) {
        const author = (r.author_name ?? '').trim();
        if (seenAuthor.has(author)) continue;
        seenAuthor.add(author);
        picked.push(r);
        if (picked.length >= FLAGS.reviews) break;
      }

      const website = (
        place?.contacts?.website ??
        matched.contacts?.website ??
        ''
      ).trim();
      let reviewsInserted = 0;

      await ds.transaction(async (mgr) => {
        // UPDATE the venue — only fields PISO provides; never touch upvotes,
        // saves, name, category, district, tags, priceRange, description.
        const patch: QueryDeepPartialEntity<Venue> = {
          address: newAddress,
          hours: newHours,
          lat: newLat,
          lng: newLng,
          images: imagesToWrite,
          website: /^https?:\/\//i.test(website)
            ? website.slice(0, 500)
            : v.website,
          externalRating: extRating,
          externalReviewCount: extReviews,
          externalId: matched.data_id ?? v.externalId,
          externalOpeningHours: matched.opening_hours ?? v.externalOpeningHours,
          externalSyncedAt: new Date(),
          source: 'google',
        };
        if (place) {
          // Full external_raw — features → additionalInfo (Vietnamese
          // category/labels) + review_list → reviews[] (apify shape with
          // reviewImageUrls for the gallery on the detail page).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          patch.externalRaw = buildExternalRaw(place, picked) as any;
        }
        await mgr.update(Venue, { id: v.id }, patch);

        // Attach scraped Google reviews. Skip authors already attached to this
        // venue (uq_review_user_venue), so re-runs are safe.
        const existingUids = new Set<string>(
          (
            await mgr.find(Review, {
              where: { venueId: v.id },
              select: { userId: true },
            })
          ).map((r) => r.userId),
        );
        let insertedLocal = 0;
        for (const r of picked) {
          const uid = await getOrCreateReviewer(
            mgr,
            r.author_name ?? '',
            r.author_profile_pic ?? '',
            reviewerCache,
          );
          if (existingUids.has(uid)) continue;
          existingUids.add(uid);
          const rating = Math.min(5, Math.max(1, Math.round(r.rating ?? 5)));
          // Preserve reviewer-attached photos (lh3.googleusercontent.com)
          // the same way import-pisomap.ts does.
          const reviewPhotos = (r.photos ?? []).map((p) => p.url ?? '').filter(Boolean);
          await mgr.save(
            mgr.create(Review, {
              venueId: v.id,
              userId: uid,
              rating,
              body: (r.text ?? '').slice(0, 4000),
              photos: reviewPhotos,
            }),
          );
          insertedLocal++;
        }

        // Re-blend rating from all real+synthetic reviews on this venue.
        // Skip when there's NOTHING to blend (no PISO reviews, no in-app
        // reviews) — otherwise blend() returns 0 and wipes the existing rating.
        // In that case keep PISO's rating if non-zero, else keep current.
        const allReviews = await mgr.find(Review, {
          where: { venueId: v.id },
          select: { rating: true },
        });
        const localCount = allReviews.length;
        if (localCount > 0 || extReviews > 0) {
          const localAvg =
            localCount > 0
              ? allReviews.reduce((s, r) => s + r.rating, 0) / localCount
              : 0;
          const b = blend(extRating, extReviews, localAvg, localCount);
          await mgr.update(Venue, { id: v.id }, b);
        } else if (extRating > 0 && extRating !== v.rating) {
          await mgr.update(Venue, { id: v.id }, { rating: extRating });
        }
        reviewsInserted = insertedLocal;
      });

      progress[v.slug] = 'saved';
      saveProgress(progress);
      updated++;
      console.log(
        `${tag} ✓ "${matched.title}" ${extRating}★/${extReviews} | +${newImages.length} imgs | +${reviewsInserted} reviews (${Date.now() - t0}ms)`,
      );
    } catch (e) {
      progress[v.slug] = 'failed';
      saveProgress(progress);
      failed++;
      console.warn(`${tag} FAILED: ${String(e)}`);
    }
  }

  const dur = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\n✓ Done in ${dur}s. updated=${updated} skipped=${skipped} notMatched=${notMatched} failed=${failed}`,
  );
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
