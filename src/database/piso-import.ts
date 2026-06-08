import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { City, Venue, Review, Ward } from './entities';
import type { Category } from './entities';
import {
  resolveWardFromVenue, toNormalizable,
  type NormalizableWard, type ResolveResult,
} from '../modules/venues/ward-resolver';
import { buildExternalRaw } from './piso-to-external-raw';
import {
  apiSearch, apiPlace, flatMedia, compactHours, uploadImage,
  getOrCreateReviewer, sleep, slugify, log, setLogFile, ensureCacheDirs,
  setCacheTtlDays, disableCache, cacheStats, requireEnv,
  type PisoSearchItem, type PisoReview,
} from './piso-api';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND 1 — Discover + import PISO venues, per city, optional category.
//
//   npx ts-node src/database/piso-import.ts --city=da-lat                 (all cats, dry-run)
//   npx ts-node src/database/piso-import.ts --city=da-lat --category=bar --count=10 --apply
//   npx ts-node src/database/piso-import.ts --city=hue --apply            (sweep all 10 cats)
//
// What it does, per venue:
//   1. Search PISO with category keywords clustered near the city center.
//   2. Drop anything with rating ≤ --min-rating OR reviews ≤ --min-reviews.
//   3. Drop anything already imported (slug OR external_id matches an
//      existing row, soft-deleted ones included).
//   4. Fetch place detail; reject if PISO offers fewer than --skip-if-imgs-lt
//      candidate photos (it'll never make the upload bar).
//   5. Download photos → WebP → upload to our CDN. Reject if fewer than
//      --min-images succeed (NO Unsplash fallback — strict on this).
//   6. Resolve canonical post-2025 ward from the refreshed address.
//   7. Build external_raw with features→additionalInfo + reviews→apify-shape
//      (with reviewImageUrls) so the FE renders amenities + review photos.
//   8. Insert venue + up to --reviews Google reviews (synthetic-user rows,
//      review.photos[] populated from reviewer-attached photos).
//
// Resilience:
//   - Search + place responses cached (TTL 30 days; --no-cache to bypass).
//   - 429 retried with exponential backoff (5s → 7s → 11s → 17s → 25s).
//   - Per-(city, category) progress file: re-runs resume past a kill / crash.
//   - Per-run log file in working dir: piso-import-<city>-<cat>-<iso>.log
// ─────────────────────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const CATEGORIES: Category[] = [
  'cafe', 'restaurant', 'street_food', 'viewpoint', 'beach',
  'homestay', 'bar', 'museum', 'park', 'shopping',
];

const FLAGS = {
  city: arg('city', ''),
  category: arg('category', '') as Category | '',
  count: parseInt(arg('count', '10'), 10),
  minRating: parseFloat(arg('min-rating', '4.0')),
  minReviews: parseInt(arg('min-reviews', '90'), 10),
  minImages: parseInt(arg('min-images', '5'), 10),
  skipIfImagesLt: parseInt(arg('skip-if-imgs-lt', '2'), 10),
  photos: parseInt(arg('photos', '5'), 10),
  reviews: parseInt(arg('reviews', '4'), 10),
  uploadDelay: parseInt(arg('upload-delay', '300'), 10),
  apiDelay: parseInt(arg('api-delay', '500'), 10),
  cacheTtlDays: parseInt(arg('cache-ttl-days', '30'), 10),
  // 2025 merger guard radius: a venue within this many km of a sibling
  // city's center is treated as belonging to that sibling and skipped.
  // 15 km comfortably excludes Hội An (~30 km from Đà Nẵng center) while
  // still letting Bà Nà Hills (40 km west of Đà Nẵng) through.
  siblingRadiusKm: parseFloat(arg('sibling-radius-km', '15')),
  noCache: process.argv.includes('--no-cache'),
  dryRun: !process.argv.includes('--apply'),
};

// ── 2025 merger guard ──────────────────────────────────────────────────────
// Resolution 36/2025/QH15 (effective 2025) merged several provinces into the
// adjacent centrally-controlled cities. Our DB keeps the OLD city slugs
// because the FE has separate landing pages for Hội An vs Đà Nẵng etc.
// PISO mirrors Google's post-merger boundaries — a search for "bar Đà Nẵng"
// now returns places in Hội An, Tam Kỳ, Mỹ Sơn, etc. that legally belong to
// the merged Đà Nẵng but in our data model belong to a sibling city slug.
//
// SIBLING_GUARDS[city] lists the patterns that, when found in a PISO result,
// mark it as "actually a sibling city's venue" → skip during import. Match
// is case-insensitive on the address text. Each guard also includes a
// sibling center coord so we can reject by proximity even when the address
// text is missing the giveaway label (Google's "Đà Nẵng" labels swallow
// older "Hội An" / "Quảng Nam" formatting in some rows).
interface SiblingGuard {
  // Whole-token regex patterns (word-boundary aware). Use `\b` between
  // tokens so "phu my" doesn't false-match "phu my hung" (Phú Mỹ Hưng,
  // a legitimate HCM Quận 7 area).
  addressPatterns: RegExp[];
  excludeNearLat?: number;       // skip if within --sibling-radius-km of these coords
  excludeNearLng?: number;
}
// Build regex that matches a phrase only when followed by whitespace,
// punctuation, or end-of-string (i.e. "phu my" but not "phu my hung").
const ph = (phrase: string): RegExp =>
  new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}(?:[\\s,.]|$)`, 'i');

const SIBLING_GUARDS: Record<string, SiblingGuard[]> = {
  // New Đà Nẵng = old Đà Nẵng + Quảng Nam. We keep `hoi-an` as its own slug
  // for the popular old town, so explicit "Hội An" / "Quảng Nam" hits get
  // diverted. Other old-Quảng-Nam districts (Tam Kỳ, Núi Thành, Duy Xuyên
  // far south) have no separate slug — keep them under `da-nang` rather
  // than dropping good content.
  'da-nang': [
    {
      addressPatterns: [
        ph('hoi an'), ph('quang nam'),
        ph('minh an'), ph('cam pho'), ph('cam an'), ph('cam thanh'),  // Hội An wards
      ],
      excludeNearLat: 15.8801, excludeNearLng: 108.338, // Hội An center
    },
  ],
  // New HCM = old HCM + Bình Dương + Bà Rịa-Vũng Tàu. We keep `vung-tau`
  // for the resort city; Bình Dương has no separate slug so its venues
  // are dropped (admin can re-route later if a Bình Dương slug is added).
  // Patterns avoid "phu my" alone (clashes with HCM's "Phú Mỹ Hưng") —
  // require "phu my " followed by a separator, NOT "hung".
  'ho-chi-minh': [
    {
      addressPatterns: [
        ph('vung tau'), ph('ba ria'), ph('con dao'), ph('long hai'),
      ],
      excludeNearLat: 10.3459, excludeNearLng: 107.0843,
    },
    {
      addressPatterns: [
        ph('binh duong'), ph('thu dau mot'), ph('thuan an'),
        ph('di an'), ph('ben cat'), ph('tan uyen'),
      ],
      excludeNearLat: 10.98, excludeNearLng: 106.65,
    },
  ],
  // Mirrors — when importing the SIBLING side, drop venues that belong
  // to the parent merged city.
  'hoi-an': [
    {
      addressPatterns: [
        ph('hai chau'), ph('son tra'), ph('thanh khe'), ph('lien chieu'),
        ph('ngu hanh son'), ph('cam le'), ph('hoa vang'),
      ],
      excludeNearLat: 16.0544, excludeNearLng: 108.2022,
    },
  ],
  'vung-tau': [
    {
      addressPatterns: [
        ph('thanh pho ho chi minh'), ph('tp hcm'), ph('tphcm'),
        ph('sai gon'), ph('thu duc'),
      ],
      excludeNearLat: 10.7769, excludeNearLng: 106.7009,
    },
  ],
};

function normalizeForGuard(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Returns the offending pattern (or "near sibling X") if the result belongs
// to a sibling city's territory and should be skipped; null otherwise.
function siblingGuardReason(
  citySlug: string,
  candidate: { location?: { latitude?: number; longitude?: number; address?: { full?: string } } },
  siblingRadiusKm: number,
): string | null {
  const guards = SIBLING_GUARDS[citySlug];
  if (!guards) return null;
  const addr = normalizeForGuard(candidate.location?.address?.full ?? '');
  const lat = candidate.location?.latitude;
  const lng = candidate.location?.longitude;
  for (const g of guards) {
    for (const pat of g.addressPatterns) {
      if (pat.test(addr)) return `address matches "${pat.source}"`;
    }
    if (typeof lat === 'number' && typeof lng === 'number'
        && g.excludeNearLat != null && g.excludeNearLng != null) {
      const d = haversineKm(lat, lng, g.excludeNearLat, g.excludeNearLng);
      if (d < siblingRadiusKm) return `${d.toFixed(1)}km from sibling city center`;
    }
  }
  return null;
}

// Category-specific search keywords. Multiple terms widen the funnel so a
// dedupe-by-data_id usually yields 50-100 candidates per category.
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  cafe:        ['cafe', 'quán cà phê', 'specialty coffee', 'rooftop cafe', 'cafe sân vườn'],
  restaurant:  ['nhà hàng', 'restaurant', 'fine dining', 'nhà hàng Việt', 'nhà hàng hải sản'],
  street_food: ['quán ăn vặt', 'street food', 'ẩm thực đường phố', 'quán ăn ngon', 'bánh tráng nướng'],
  viewpoint:   ['điểm ngắm cảnh', 'view đẹp', 'thắng cảnh', 'núi', 'thác nước', 'đồi', 'hồ'],
  beach:       ['bãi biển', 'beach', 'bãi tắm'],
  homestay:    ['homestay', 'boutique homestay', 'guesthouse', 'hostel'],
  bar:         ['bar', 'quán bar', 'cocktail bar', 'rooftop bar', 'craft beer', 'pub', 'club'],
  museum:      ['bảo tàng', 'museum', 'di tích', 'đền chùa', 'nhà thờ'],
  park:        ['công viên', 'park', 'vườn quốc gia', 'khu sinh thái'],
  shopping:    ['chợ', 'shopping mall', 'trung tâm thương mại', 'siêu thị', 'cửa hàng lưu niệm'],
};

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

async function importCategory(
  ds: DataSource,
  city: { id: string; slug: string; name: string; lat: number; lng: number },
  cityWards: NormalizableWard[],
  category: Category,
): Promise<{ imported: number; skipped: number; failed: number }> {
  const venueRepo = ds.getRepository(Venue);
  const PROGRESS = resolve(process.cwd(), `piso-import-${city.slug}-${category}.json`);
  const progress: Record<string, string> = existsSync(PROGRESS)
    ? JSON.parse(readFileSync(PROGRESS, 'utf8')) : {};
  const saveProgress = () => writeFileSync(PROGRESS, JSON.stringify(progress));

  log(`\n══ ${city.slug} / ${category}  (target ${FLAGS.count}) ══`);

  // PHASE 1 — search
  const keywords = CATEGORY_KEYWORDS[category];
  const candidates = new Map<string, PisoSearchItem>();
  let siblingRejected = 0;
  for (const kw of keywords) {
    const q = `${kw} ${city.name}`;
    const hitsBefore = cacheStats.searchHit;
    log(`  🔍 "${q}"`);
    try {
      const results = await apiSearch(q, city.lat, city.lng);
      const fromCache = cacheStats.searchHit > hitsBefore;
      log(`     ← ${results.length} results ${fromCache ? '(cache)' : '(api)'}`);
      for (const r of results) {
        if (!r.data_id || !r.title) continue;
        const la = r.location?.latitude, lo = r.location?.longitude;
        if (typeof la === 'number' && typeof lo === 'number') {
          if (haversineKm(city.lat, city.lng, la, lo) > 120) continue;
        }
        // 2025 merger guard — a search for "bar Đà Nẵng" can now return
        // Hội An / Tam Kỳ / Mỹ Sơn rows; reject them so they don't get
        // mis-attached to the wrong city slug in our DB.
        const siblingReject = siblingGuardReason(city.slug, r, FLAGS.siblingRadiusKm);
        if (siblingReject) {
          siblingRejected++;
          continue;
        }
        if (!candidates.has(r.data_id)) candidates.set(r.data_id, r);
      }
      if (!fromCache) await sleep(FLAGS.apiDelay);
    } catch (e) {
      log(`     ✗ search failed: ${String(e).slice(0, 120)}`);
      await sleep(FLAGS.apiDelay);
    }
  }
  log(`  → ${candidates.size} unique candidates${siblingRejected ? ` (rejected ${siblingRejected} sibling-city venues)` : ''}`);

  // PHASE 2 — quality filter on search-level fields + dedupe
  let droppedRating = 0, droppedReviews = 0, droppedDup = 0;
  const passing: PisoSearchItem[] = [];
  for (const c of candidates.values()) {
    if ((c.rating ?? 0) <= FLAGS.minRating) { droppedRating++; continue; }
    if ((c.reviews ?? 0) <= FLAGS.minReviews) { droppedReviews++; continue; }
    const dup = await venueRepo.findOne({
      where: { externalId: c.data_id! }, withDeleted: true, select: { id: true },
    });
    if (dup) { droppedDup++; continue; }
    passing.push(c);
  }
  passing.sort((a, b) => {
    const sa = (a.rating ?? 0) * Math.log10((a.reviews ?? 0) + 1);
    const sb = (b.rating ?? 0) * Math.log10((b.reviews ?? 0) + 1);
    return sb - sa;
  });
  log(`  → ${passing.length} pass quality (dropped: rating=${droppedRating}, reviews=${droppedReviews}, dup=${droppedDup})`);

  if (passing.length === 0) {
    return { imported: 0, skipped: droppedDup, failed: 0 };
  }

  // PHASE 3 — import each passing candidate
  let imported = 0, skipped = 0, failed = 0;
  const reviewerCache = new Map<string, string>();

  for (const c of passing) {
    if (imported >= FLAGS.count) {
      log(`  ✓ reached --count=${FLAGS.count}`);
      break;
    }
    const slug = `${slugify(c.title!)}-${city.slug}`;
    if (progress[slug] === 'saved' || progress[slug] === 'skipped') {
      skipped++;
      continue;
    }
    const exists = await venueRepo.findOne({
      where: { slug }, withDeleted: true, select: { id: true },
    });
    if (exists) {
      progress[slug] = 'skipped'; saveProgress();
      log(`  ⤷ slug exists: ${c.title}`);
      skipped++;
      continue;
    }

    log(`  ▶ ${c.title}  (${c.rating}★ / ${c.reviews})`);
    try {
      const lat = c.location?.latitude ?? city.lat;
      const lng = c.location?.longitude ?? city.lng;
      const place = await apiPlace(c.data_id!, lat, lng);
      await sleep(FLAGS.apiDelay);

      if (!place) {
        log(`    ✗ no place detail`);
        progress[slug] = 'skipped'; saveProgress();
        skipped++;
        continue;
      }

      const mediaUrls = flatMedia(place);
      log(`    image candidates: ${mediaUrls.length}`);
      if (mediaUrls.length < FLAGS.skipIfImagesLt) {
        log(`    ✗ SKIP — fewer than ${FLAGS.skipIfImagesLt} image candidates`);
        progress[slug] = 'skipped-no-img'; saveProgress();
        skipped++;
        continue;
      }

      // Upload images. NO Unsplash fallback — strict on real photos only.
      const images: string[] = [];
      if (FLAGS.dryRun) {
        images.push(...mediaUrls.slice(0, FLAGS.photos));
      } else {
        for (const u of mediaUrls.slice(0, FLAGS.photos * 3)) {
          if (images.length >= FLAGS.photos) break;
          try {
            images.push(await uploadImage(u));
          } catch (e) {
            log(`    img failed: ${String(e).slice(0, 100)}`);
          }
          await sleep(FLAGS.uploadDelay);
        }
      }
      log(`    uploaded ${images.length}/${FLAGS.photos}`);
      if (images.length < FLAGS.minImages) {
        log(`    ✗ SKIP — only ${images.length} images < ${FLAGS.minImages}`);
        progress[slug] = 'skipped-too-few-img'; saveProgress();
        skipped++;
        continue;
      }

      // Pick reviews — prefer photo-heavy ones for the FE gallery
      const picked: PisoReview[] = [];
      const seen = new Set<string>();
      const sorted = (place.review_list ?? [])
        .filter((r) => (r.text ?? '').trim().length >= 8 && (r.author_name ?? '').trim())
        .sort((a, b) =>
          ((b.photos?.length ?? 0) - (a.photos?.length ?? 0)) ||
          ((b.rating ?? 0) - (a.rating ?? 0)) ||
          ((b.text ?? '').length - (a.text ?? '').length));
      for (const r of sorted) {
        const author = (r.author_name ?? '').trim();
        if (seen.has(author)) continue;
        seen.add(author);
        picked.push(r);
        if (picked.length >= FLAGS.reviews) break;
      }
      const reviewPhotoCount = picked.reduce((n, r) => n + (r.photos?.length ?? 0), 0);

      // Ward resolution from refreshed address
      const address = (c.location?.address?.full ?? `${city.name}`).slice(0, 240);
      const wardResolve: ResolveResult | null = resolveWardFromVenue(null, address, cityWards);
      const district = (wardResolve?.wardCanonical ?? '').slice(0, 80);

      if (FLAGS.dryRun) {
        log(`    [dry] ${images.length} imgs | ${picked.length} reviews (+${reviewPhotoCount} photos) | ward=${wardResolve?.wardCanonical ?? 'NULL'}`);
        imported++;
        continue;
      }

      const website = (place.contacts?.website ?? c.contacts?.website ?? '').trim();
      const hours = compactHours(c.opening_hours) || 'Liên hệ';
      const description = (place.description ?? `${c.title} — ${city.name}.`).slice(0, 2000);

      let reviewsInserted = 0;
      await ds.transaction(async (mgr) => {
        const venue = await mgr.save(mgr.create(Venue, {
          slug,
          name: c.title!.slice(0, 160),
          category,
          cityId: city.id,
          district,
          wardCanonical: wardResolve?.wardCanonical ?? null,
          wardType: wardResolve?.wardType ?? null,
          wardResolutionMethod: wardResolve?.method ?? null,
          address,
          description,
          website: /^https?:\/\//i.test(website) ? website.slice(0, 500) : null,
          images,
          tags: [`${category}-discovered`],
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          externalRaw: buildExternalRaw(place, picked) as any,
          source: 'google',
          upvotes: seedRandom(slug, 2500, 100),
          isPublished: true,
        }));

        let sum = 0, inserted = 0;
        const usedUid = new Set<string>();
        for (const r of picked) {
          const uid = await getOrCreateReviewer(
            mgr, r.author_name ?? '', r.author_profile_pic ?? '', reviewerCache,
          );
          if (usedUid.has(uid)) continue;
          usedUid.add(uid);
          const rating = Math.min(5, Math.max(1, Math.round(r.rating ?? 5)));
          const photos = (r.photos ?? []).map((p) => p.url ?? '').filter(Boolean);
          await mgr.save(mgr.create(Review, {
            venueId: venue.id, userId: uid, rating,
            body: (r.text ?? '').slice(0, 4000),
            photos,
          }));
          sum += rating;
          inserted++;
        }
        if (inserted > 0) {
          const blended =
            ((c.rating ?? 0) * (c.reviews ?? 0) + (sum / inserted) * inserted) /
            ((c.reviews ?? 0) + inserted);
          await mgr.update(Venue, { id: venue.id }, {
            rating: Math.round(blended * 100) / 100,
            reviewCount: (c.reviews ?? 0) + inserted,
          });
        }
        reviewsInserted = inserted;
      });
      progress[slug] = 'saved'; saveProgress();
      imported++;
      log(`    ✓ imported (${imported}/${FLAGS.count}) — ${images.length} imgs, ${reviewsInserted} reviews (+${reviewPhotoCount} review photos), ward=${wardResolve?.wardCanonical ?? 'NULL'}`);
    } catch (e) {
      progress[slug] = 'failed'; saveProgress();
      failed++;
      log(`    ✗ FAILED: ${String(e).slice(0, 200)}`);
    }
  }

  return { imported, skipped, failed };
}

async function main(): Promise<void> {
  requireEnv(!FLAGS.dryRun);
  if (!FLAGS.city) throw new Error('--city=<slug> required');
  if (FLAGS.category && !CATEGORIES.includes(FLAGS.category as Category)) {
    throw new Error(`--category must be one of: ${CATEGORIES.join(', ')}`);
  }

  ensureCacheDirs();
  setCacheTtlDays(FLAGS.cacheTtlDays);
  if (FLAGS.noCache) disableCache();

  const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
  const LOG_FILE = resolve(
    process.cwd(),
    `piso-import-${FLAGS.city}-${FLAGS.category || 'all'}-${RUN_ID}.log`,
  );
  setLogFile(LOG_FILE);
  log(`▶ START ${FLAGS.dryRun ? '🟡 DRY-RUN' : '🔴 APPLY'}  city=${FLAGS.city}  category=${FLAGS.category || 'ALL'}  count/cat=${FLAGS.count}`);
  log(`  gate: rating>${FLAGS.minRating}, reviews>${FLAGS.minReviews}, real images>=${FLAGS.minImages}`);
  log(`  log: ${LOG_FILE}`);

  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();

  const city = await ds.getRepository(City).findOne({ where: { slug: FLAGS.city } });
  if (!city) throw new Error(`city "${FLAGS.city}" not found`);
  if (city.lat == null || city.lng == null) {
    throw new Error(`city "${FLAGS.city}" missing lat/lng`);
  }
  const cityCtx = {
    id: city.id, slug: city.slug, name: city.name, lat: city.lat, lng: city.lng,
  };

  const wardEntities = await ds.getRepository(Ward).find({ where: { city: { id: city.id } } });
  const cityWards: NormalizableWard[] = toNormalizable(wardEntities.map((w) => ({
    name: w.name,
    type: w.type as 'phuong' | 'xa' | 'dac_khu',
    aliasesOldDistrict: w.aliasesOldDistrict ?? [],
    aliasesOldWards: w.aliasesOldWards ?? [],
    aliasesUser: w.aliasesUser ?? [],
  })));
  log(`  ward index: ${cityWards.length} canonical wards`);

  const categories: Category[] = FLAGS.category
    ? [FLAGS.category as Category]
    : CATEGORIES;

  let totalImported = 0, totalSkipped = 0, totalFailed = 0;
  for (const cat of categories) {
    const { imported, skipped, failed } = await importCategory(ds, cityCtx, cityWards, cat);
    totalImported += imported;
    totalSkipped += skipped;
    totalFailed += failed;
  }

  log(`\n▶ DONE  imported=${totalImported}  skipped=${totalSkipped}  failed=${totalFailed}`);
  log(`  cache: search ${cacheStats.searchHit}/${cacheStats.searchHit + cacheStats.searchMiss}, place ${cacheStats.placeHit}/${cacheStats.placeHit + cacheStats.placeMiss}`);
  log(`  log saved: ${LOG_FILE}`);
  if (FLAGS.dryRun) log(`  (dry-run — pass --apply to commit)`);
  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
