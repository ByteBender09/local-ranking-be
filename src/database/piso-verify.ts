import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';
import { DataSource, In } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue, Review, Ward } from './entities';
import {
  resolveWardFromVenue, toNormalizable,
  type NormalizableWard, type ResolveResult,
} from '../modules/venues/ward-resolver';
import { buildExternalRaw } from './piso-to-external-raw';
import {
  apiSearch, apiPlace, flatMedia, compactHours, uploadImage,
  getOrCreateReviewer, sleep, log, setLogFile, ensureCacheDirs,
  setCacheTtlDays, disableCache, cacheStats, requireEnv,
  BACKEND, ADMIN_JWT,
  type PisoSearchItem, type PisoPlace, type PisoReview,
} from './piso-api';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND 2 — Audit + verify + fix venues that don't pass quality bar.
//
// Selection: any venue (excluding curated by default) that fails ANY of:
//   - external_review_count <= --min-reviews   (default 100)
//   - rating <= --min-rating                   (default 4.0)
//   - images empty OR all images.unsplash.com  (placeholder leak)
//   - ward_canonical IS NULL                   (ward never resolved)
//
// For each failing venue:
//   1. Refresh from PISO (external_id → /place, else search by name+coords).
//   2. Apply the same quality gate to the refreshed data.
//   3. PASS → upload 5 fresh images to our CDN, replace images[], rebuild
//      external_raw (additionalInfo + reviews with photos), re-resolve
//      ward, blend rating, sync to row. NO Unsplash fallback.
//   4. FAIL or PISO 404 → soft-delete the venue (cascades to reviews/votes/
//      saves) AND queue its CDN images for unlink (--cleanup-volume).
//   5. Curated rows that PISO can't find: KEEP (don't auto-delete hand-
//      seeded landmarks — surface them in the kept-curated counter).
//
//   npx ts-node src/database/piso-verify.ts                              (dry-run, all cities)
//   npx ts-node src/database/piso-verify.ts --city=hue --apply
//   npx ts-node src/database/piso-verify.ts --limit=20 --dry-run
//   npx ts-node src/database/piso-verify.ts --apply --cleanup-volume     (also unlink CDN files)
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
  includeCurated: !process.argv.includes('--exclude-curated'),
  cleanupVolume: process.argv.includes('--cleanup-volume'),
  apply: process.argv.includes('--apply'),
};

interface FailingVenue {
  id: string; slug: string; name: string; city_slug: string;
  external_id: string | null; lat: number; lng: number; source: string;
  rating: string; external_review_count: number;
  images: string[]; ward_canonical: string | null; address: string;
}

async function refreshFromPiso(
  v: FailingVenue,
): Promise<{ place: PisoPlace | null; matched: PisoSearchItem | null; gone: boolean }> {
  // Prefer external_id (one /place call). Fall back to /search if missing.
  if (v.external_id) {
    try {
      const place = await apiPlace(v.external_id, v.lat, v.lng);
      return { place, matched: place, gone: false };
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      if (String(e).includes('404') || status === 404) {
        log(`  ⤷ PISO 404 — place delisted`);
        return { place: null, matched: null, gone: true };
      }
      throw e;
    }
  }
  log(`  ⤷ no external_id — searching PISO`);
  const results = await apiSearch(v.name, v.lat, v.lng);
  await sleep(FLAGS.apiDelay);
  const matched = results[0] ?? null;
  if (!matched?.data_id) return { place: null, matched: null, gone: false };
  try {
    const place = await apiPlace(matched.data_id, v.lat, v.lng);
    await sleep(FLAGS.apiDelay);
    return { place, matched, gone: false };
  } catch (e) {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    if (String(e).includes('404') || status === 404) {
      return { place: null, matched: null, gone: true };
    }
    throw e;
  }
}

async function unlinkCdnFiles(urls: string[]): Promise<number> {
  if (urls.length === 0) return 0;
  const owned = urls.filter((u) => {
    try {
      const p = u.startsWith('/') ? u : new URL(u).pathname;
      return p.startsWith('/uploads/');
    } catch { return false; }
  });
  if (owned.length === 0) return 0;
  try {
    const res = await axios.delete<{
      success?: boolean; data?: { removed: number };
    }>(`${BACKEND}/admin/uploads/by-urls`, {
      data: { urls: owned },
      headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      timeout: 60000,
    });
    return res.data?.data?.removed ?? 0;
  } catch (e) {
    log(`  ⚠ unlink failed: ${String(e).slice(0, 100)}`);
    return 0;
  }
}

async function main(): Promise<void> {
  requireEnv(FLAGS.apply);
  ensureCacheDirs();
  setCacheTtlDays(FLAGS.cacheTtlDays);
  if (FLAGS.noCache) disableCache();

  const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
  const LOG_FILE = resolve(
    process.cwd(),
    `piso-verify-${FLAGS.city || 'all'}-${RUN_ID}.log`,
  );
  setLogFile(LOG_FILE);
  log(`▶ START ${FLAGS.apply ? '🔴 APPLY' : '🟡 DRY-RUN'}  city=${FLAGS.city || 'all'}  limit=${FLAGS.limit || 'none'}`);
  log(`  gate: rating>${FLAGS.minRating}, reviews>${FLAGS.minReviews}, real images>=${FLAGS.minImages}`);
  log(`  scope: ${FLAGS.includeCurated ? 'INCLUDE curated' : 'exclude curated'}`);
  log(`  cleanup volume: ${FLAGS.cleanupVolume}`);
  log(`  log: ${LOG_FILE}`);

  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const venueRepo = ds.getRepository(Venue);

  // Pre-load wards for re-resolution
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

  // PHASE 1 — query failing venues
  const conds: string[] = [`v.deleted_at IS NULL`, `v.is_published = true`];
  if (!FLAGS.includeCurated) conds.push(`v.source <> 'curated'`);
  if (FLAGS.city) conds.push(`c.slug = '${FLAGS.city.replace(/'/g, '')}'`);

  const failingClause = `(
    COALESCE(v.external_review_count, 0) <= ${FLAGS.minReviews}
    OR COALESCE(v.rating, 0) <= ${FLAGS.minRating}
    OR COALESCE(array_length(v.images, 1), 0) = 0
    OR (
      COALESCE(array_length(v.images, 1), 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM unnest(v.images) i WHERE i NOT LIKE 'https://images.unsplash.com/%'
      )
    )
    OR v.ward_canonical IS NULL
  )`;
  const limitSql = FLAGS.limit > 0 ? `LIMIT ${FLAGS.limit}` : '';

  const venues: FailingVenue[] = await ds.query(`
    SELECT v.id, v.slug, v.name, c.slug AS city_slug,
           v.external_id, v.lat, v.lng, v.source,
           v.rating, v.external_review_count, v.images,
           v.ward_canonical, v.address
    FROM venues v JOIN cities c ON c.id = v.city_id
    WHERE ${conds.join(' AND ')} AND ${failingClause}
    ORDER BY v.external_review_count DESC NULLS LAST
    ${limitSql}`);

  log(`\nAudit: ${venues.length} venues fail quality gate\n`);
  if (venues.length === 0) { await ds.destroy(); return; }

  // PHASE 2 — refresh + decide per venue
  const reviewerCache = new Map<string, string>();
  const filesToUnlink: string[] = [];
  let updated = 0, deleted = 0, keptCurated = 0, failed = 0;
  let totalAmenityGroups = 0, totalReviewPhotos = 0;

  for (let i = 0; i < venues.length; i++) {
    const v = venues[i];
    log(`[${i + 1}/${venues.length}] ${v.city_slug} / ${v.name}  (source=${v.source}, ext=${!!v.external_id})`);
    log(`  current: ${v.rating}★ ${v.external_review_count} reviews, ${v.images?.length ?? 0} imgs, ward=${v.ward_canonical ?? 'NULL'}`);

    try {
      const { place, matched, gone } = await refreshFromPiso(v);

      if (!place || !matched) {
        // Curated landmark with no PISO match: KEEP. Anything else: DELETE.
        if (v.source === 'curated' && !gone) {
          log(`  ⊙ KEEP — curated, no PISO match (manual review needed)`);
          keptCurated++;
          continue;
        }
        log(`  ✗ DELETE — ${gone ? 'PISO 404' : 'no match'}`);
        if (FLAGS.apply) {
          await venueRepo.softDelete({ id: v.id });
          if (FLAGS.cleanupVolume) filesToUnlink.push(...(v.images ?? []));
        }
        deleted++;
        continue;
      }

      // Dedupe: a curated venue whose PISO match is already in DB under
      // another slug = duplicate. Soft-delete it instead of updating.
      const matchedDataId = matched.data_id;
      if (matchedDataId && matchedDataId !== v.external_id) {
        const dup = await venueRepo.findOne({
          where: { externalId: matchedDataId },
          select: { id: true, slug: true },
        });
        if (dup) {
          log(`  ✗ DELETE — PISO place_id already imported as "${dup.slug}"`);
          if (FLAGS.apply) {
            await venueRepo.softDelete({ id: v.id });
            if (FLAGS.cleanupVolume) filesToUnlink.push(...(v.images ?? []));
          }
          deleted++;
          continue;
        }
      }

      const newRating = matched.rating ?? place.rating ?? 0;
      const newReviews = matched.reviews ?? place.reviews ?? 0;
      const mediaUrls = flatMedia(place);
      log(`  fresh: ${newRating}★ ${newReviews} reviews, ${mediaUrls.length} img candidates`);

      const failsRating = newRating <= FLAGS.minRating;
      const failsReviews = newReviews <= FLAGS.minReviews;
      const failsImgPool = mediaUrls.length < FLAGS.minImages;
      if (failsRating || failsReviews || failsImgPool) {
        const why = [
          failsRating && `rating ${newRating}<=${FLAGS.minRating}`,
          failsReviews && `reviews ${newReviews}<=${FLAGS.minReviews}`,
          failsImgPool && `img candidates ${mediaUrls.length}<${FLAGS.minImages}`,
        ].filter(Boolean).join(', ');
        if (v.source === 'curated') {
          log(`  ⊙ KEEP — curated, fails refresh (${why})`);
          keptCurated++;
          continue;
        }
        log(`  ✗ DELETE — fails refresh (${why})`);
        if (FLAGS.apply) {
          await venueRepo.softDelete({ id: v.id });
          if (FLAGS.cleanupVolume) filesToUnlink.push(...(v.images ?? []));
        }
        deleted++;
        continue;
      }

      // PASS — upload images
      log(`  ✓ passes — uploading images…`);
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
            log(`  ⊙ KEEP — only ${newImages.length} uploads (curated safety)`);
            keptCurated++;
            continue;
          }
          log(`  ✗ DELETE — only ${newImages.length}/${FLAGS.minImages} uploads`);
          await venueRepo.softDelete({ id: v.id });
          if (FLAGS.cleanupVolume) filesToUnlink.push(...(v.images ?? []));
          deleted++;
          continue;
        }
      }

      // Pick reviews (prefer photo-heavy)
      const picked: PisoReview[] = [];
      const seen = new Set<string>();
      const sortedR = (place.review_list ?? [])
        .filter((r) => (r.text ?? '').trim().length >= 8 && (r.author_name ?? '').trim())
        .sort((a, b) =>
          ((b.photos?.length ?? 0) - (a.photos?.length ?? 0)) ||
          ((b.rating ?? 0) - (a.rating ?? 0)) ||
          ((b.text ?? '').length - (a.text ?? '').length));
      for (const r of sortedR) {
        const author = (r.author_name ?? '').trim();
        if (seen.has(author)) continue;
        seen.add(author);
        picked.push(r);
        if (picked.length >= FLAGS.reviews) break;
      }
      const reviewPhotoCount = picked.reduce((n, r) => n + (r.photos?.length ?? 0), 0);

      // Re-resolve ward
      const cityWards = wardsByCity.get(v.city_slug) ?? [];
      const newAddress = matched.location?.address?.full ?? place.location?.address?.full ?? v.address ?? '';
      const wardResolve: ResolveResult | null = resolveWardFromVenue(null, newAddress, cityWards);
      const externalRaw = buildExternalRaw(place, picked);
      const amenityGroups = externalRaw.additionalInfo
        ? Object.keys(externalRaw.additionalInfo as Record<string, unknown>).length : 0;

      if (!FLAGS.apply) {
        log(`  [dry] UPDATE — ${newImages.length || FLAGS.photos} imgs, ${picked.length} reviews (+${reviewPhotoCount} photos), ${amenityGroups} amenity groups, ward=${wardResolve?.wardCanonical ?? 'NULL'}`);
        updated++;
        totalAmenityGroups += amenityGroups;
        totalReviewPhotos += reviewPhotoCount;
        continue;
      }

      // Commit UPDATE — venue + replace reviews
      const oldImages = v.images ?? [];
      await ds.transaction(async (mgr) => {
        // Replace synthetic-user reviews. Real (non-synthetic) reviews on
        // this venue stay because they FK to the venue row, not the
        // refresh batch — but synthetic ones get pruned by user handle
        // pattern when we upsert below.
        await mgr.query(
          `DELETE FROM reviews WHERE venue_id = $1 AND user_id IN (
             SELECT id FROM users WHERE is_synthetic = true
           )`,
          [v.id],
        );

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
            venueId: v.id, userId: uid, rating,
            body: (r.text ?? '').slice(0, 4000),
            photos,
          }));
          sum += rating;
          inserted++;
        }
        const blended = inserted > 0
          ? (newRating * newReviews + (sum / inserted) * inserted) / (newReviews + inserted)
          : newRating;

        const newWebsite = (place.contacts?.website ?? matched.contacts?.website ?? '').trim();
        const newHours = compactHours(matched.opening_hours) || compactHours(place.opening_hours) || '';

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          externalRaw: externalRaw as any,
          externalSyncedAt: new Date(),
          source: 'google',
        });
        totalAmenityGroups += amenityGroups;
        totalReviewPhotos += reviewPhotoCount;
      });
      // Old images no longer referenced — queue for unlink
      if (FLAGS.cleanupVolume) {
        for (const oldUrl of oldImages) {
          if (!newImages.includes(oldUrl)) filesToUnlink.push(oldUrl);
        }
      }
      updated++;
      log(`  ✓ UPDATED — ${newImages.length} imgs, ${picked.length} reviews (+${reviewPhotoCount} photos), ${amenityGroups} amenity groups`);
    } catch (e) {
      failed++;
      log(`  ✗ FAILED: ${String(e).slice(0, 200)}`);
    }
  }

  // PHASE 3 — optional volume cleanup
  if (FLAGS.apply && FLAGS.cleanupVolume && filesToUnlink.length > 0) {
    log(`\n▶ Unlinking ${filesToUnlink.length} orphan files from volume…`);
    let removed = 0;
    for (let i = 0; i < filesToUnlink.length; i += 50) {
      const batch = filesToUnlink.slice(i, i + 50);
      try {
        removed += await unlinkCdnFiles(batch);
      } catch (e) {
        log(`  ✗ batch failed: ${String(e).slice(0, 100)}`);
      }
      await sleep(1500);
    }
    log(`  ✓ ${removed}/${filesToUnlink.length} files unlinked`);
  }

  log(`\n▶ DONE`);
  log(`  updated=${updated}  deleted=${deleted}  kept-curated=${keptCurated}  failed=${failed}`);
  if (updated > 0) log(`  totals on update: ${totalAmenityGroups} amenity groups, ${totalReviewPhotos} review photos`);
  log(`  cache: search ${cacheStats.searchHit}/${cacheStats.searchHit + cacheStats.searchMiss}, place ${cacheStats.placeHit}/${cacheStats.placeHit + cacheStats.placeMiss}`);
  log(`  log saved: ${LOG_FILE}`);
  if (!FLAGS.apply) log(`  (dry-run — pass --apply to commit)`);
  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
