import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';

dotenv.config();

// Read-only audit. Counts venues that fail any of the quality criteria the
// 2026-06 cleanup introduced. Use this BEFORE running the verify-and-fix
// script so you know roughly how big the cleanup queue is.
//
// Criteria (a venue fails if it matches ANY of these):
//   A. external_review_count <= --min-reviews   (default 30)
//   B. all images are from images.unsplash.com  (placeholder pool leak)
//   C. rating <= --min-rating                   (default 4.0)
//   D. ward_canonical IS NULL                   (ward never resolved)
//
// SCOPE: counts ALL published venues by default (including curated). Earlier
// versions excluded curated which silently hid the Unsplash placeholder pool
// leak in hand-seeded landmark venues. Use --exclude-curated when you only
// want to see Google-imported rows.
//
//   npx ts-node src/database/_diag-venue-quality-audit.ts                     (all)
//   npx ts-node src/database/_diag-venue-quality-audit.ts --exclude-curated   (google only)
//   npx ts-node src/database/_diag-venue-quality-audit.ts --min-reviews=30

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

// Default now includes curated — curated venues using the Unsplash pool was
// the very leak that prompted this audit. Pass --exclude-curated to revert.
// The legacy --include-curated flag is still honoured for callers that set it.
const INCLUDE_CURATED = !process.argv.includes('--exclude-curated');
const MIN_REVIEWS = parseInt(arg('min-reviews', '30'), 10);
const MIN_RATING = parseFloat(arg('min-rating', '4.0'));

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();

  const baseFilter = INCLUDE_CURATED
    ? `v.deleted_at IS NULL AND v.is_published = true`
    : `v.deleted_at IS NULL AND v.is_published = true AND v.source <> 'curated'`;

  console.log(`\n=== Venue quality audit ===`);
  console.log(`Scope: ${INCLUDE_CURATED ? 'ALL published venues (curated + google)' : 'non-curated only (pass --exclude-curated to see this)'}\n`);

  const total = await ds.query(`SELECT COUNT(*)::int AS n FROM venues v WHERE ${baseFilter}`);
  console.log(`Universe: ${total[0].n} venues\n`);

  // A — low reviews
  const a = await ds.query(`
    SELECT COUNT(*)::int AS n FROM venues v
    WHERE ${baseFilter} AND COALESCE(v.external_review_count, 0) <= ${MIN_REVIEWS}`);
  // B — all images unsplash (ARRAY check: every URL starts with unsplash)
  const b = await ds.query(`
    SELECT COUNT(*)::int AS n FROM venues v
    WHERE ${baseFilter}
      AND COALESCE(array_length(v.images, 1), 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM unnest(v.images) img
        WHERE img NOT LIKE 'https://images.unsplash.com/%'
      )`);
  // B-empty — no images at all (also a leak signal)
  const bEmpty = await ds.query(`
    SELECT COUNT(*)::int AS n FROM venues v
    WHERE ${baseFilter} AND COALESCE(array_length(v.images, 1), 0) = 0`);
  // C — low rating
  const c = await ds.query(`
    SELECT COUNT(*)::int AS n FROM venues v
    WHERE ${baseFilter} AND COALESCE(v.rating, 0) <= ${MIN_RATING}`);
  // D — ward null
  const d = await ds.query(`
    SELECT COUNT(*)::int AS n FROM venues v
    WHERE ${baseFilter} AND v.ward_canonical IS NULL`);

  console.log(`A. external_review_count <= ${MIN_REVIEWS.toString().padEnd(4)}     : ${a[0].n}`);
  console.log(`B. all images are Unsplash placeholders : ${b[0].n}`);
  console.log(`B*. zero images                          : ${bEmpty[0].n}`);
  console.log(`C. rating <= ${MIN_RATING.toFixed(1).padEnd(5)}                      : ${c[0].n}`);
  console.log(`D. ward_canonical IS NULL                : ${d[0].n}`);

  // Total unique failing — union of A∪B∪C∪D (no double-counting)
  const failing = await ds.query(`
    SELECT COUNT(*)::int AS n FROM venues v
    WHERE ${baseFilter} AND (
      COALESCE(v.external_review_count, 0) <= ${MIN_REVIEWS}
      OR (
        COALESCE(array_length(v.images, 1), 0) > 0
        AND NOT EXISTS (
          SELECT 1 FROM unnest(v.images) img
          WHERE img NOT LIKE 'https://images.unsplash.com/%'
        )
      )
      OR COALESCE(array_length(v.images, 1), 0) = 0
      OR COALESCE(v.rating, 0) <= ${MIN_RATING}
      OR v.ward_canonical IS NULL
    )`);
  console.log(`\n● TOTAL failing (A∪B∪B*∪C∪D): ${failing[0].n} venues`);

  // Breakdown per city
  console.log(`\n=== Per-city breakdown ===`);
  const byCity = await ds.query(`
    SELECT c.name AS city, COUNT(*)::int AS failing
    FROM venues v JOIN cities c ON c.id = v.city_id
    WHERE ${baseFilter} AND (
      COALESCE(v.external_review_count, 0) <= ${MIN_REVIEWS}
      OR (
        COALESCE(array_length(v.images, 1), 0) > 0
        AND NOT EXISTS (
          SELECT 1 FROM unnest(v.images) img
          WHERE img NOT LIKE 'https://images.unsplash.com/%'
        )
      )
      OR COALESCE(array_length(v.images, 1), 0) = 0
      OR COALESCE(v.rating, 0) <= ${MIN_RATING}
      OR v.ward_canonical IS NULL
    )
    GROUP BY c.name ORDER BY failing DESC`);
  console.table(byCity);

  // Sample 20 to eyeball
  console.log(`\n=== Sample failing venues (top 20 by review count) ===`);
  const sample = await ds.query(`
    SELECT c.name AS city, v.name, v.category,
           COALESCE(v.external_review_count, 0)::int AS reviews,
           COALESCE(v.rating, 0)::numeric(3,2) AS rating,
           v.ward_canonical,
           CASE
             WHEN COALESCE(array_length(v.images, 1), 0) = 0 THEN 'empty'
             WHEN NOT EXISTS (
               SELECT 1 FROM unnest(v.images) i
               WHERE i NOT LIKE 'https://images.unsplash.com/%'
             ) THEN 'all-unsplash'
             ELSE 'mixed/own'
           END AS img_state,
           v.external_id IS NOT NULL AS has_ext_id
    FROM venues v JOIN cities c ON c.id = v.city_id
    WHERE ${baseFilter} AND (
      COALESCE(v.external_review_count, 0) <= ${MIN_REVIEWS}
      OR (
        COALESCE(array_length(v.images, 1), 0) > 0
        AND NOT EXISTS (
          SELECT 1 FROM unnest(v.images) img
          WHERE img NOT LIKE 'https://images.unsplash.com/%'
        )
      )
      OR COALESCE(array_length(v.images, 1), 0) = 0
      OR COALESCE(v.rating, 0) <= ${MIN_RATING}
      OR v.ward_canonical IS NULL
    )
    ORDER BY COALESCE(v.external_review_count, 0) DESC
    LIMIT 20`);
  console.table(sample);

  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
