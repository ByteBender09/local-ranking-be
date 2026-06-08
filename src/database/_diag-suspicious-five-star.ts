import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue } from './entities';

dotenv.config();

// Lists (and optionally soft-deletes) venues that match the "rating 5.0 +
// low review count" spam pattern. Examples in the wild:
//   - "Dự Án Sun Centro Town - GĐDA Hoàng Oanh" (real estate sales listing)
//   - "Trà Sữa Hương Hương" (5 reviews, all friends/family)
//   - Unicode-fancy-font brand names ("𝘾𝙊𝘾𝘼 𝘾𝙇𝙐𝘽")
// These are almost never real POIs — they're businesses gaming Google with
// hand-picked reviews from the owner's circle. Five stars from a tiny sample
// has no statistical meaning either way; cheaper to remove than to verify
// one by one.
//
// USAGE
//   npx ts-node src/database/_diag-suspicious-five-star.ts                  (list)
//   npx ts-node src/database/_diag-suspicious-five-star.ts --max-reviews=20 (stricter)
//   npx ts-node src/database/_diag-suspicious-five-star.ts --apply          (soft-delete)
//   npx ts-node src/database/_diag-suspicious-five-star.ts --city=quang-ninh
//   npx ts-node src/database/_diag-suspicious-five-star.ts --include-curated

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const FLAGS = {
  maxReviews: parseInt(arg('max-reviews', '50'), 10),
  rating: parseFloat(arg('rating', '5.0')),
  city: arg('city', ''),
  apply: process.argv.includes('--apply'),
  includeCurated: process.argv.includes('--include-curated'),
};

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();

  const conds = [
    `v.deleted_at IS NULL`,
    `v.is_published = true`,
    `COALESCE(v.rating, 0) = ${FLAGS.rating}`,
    `COALESCE(v.external_review_count, 0) < ${FLAGS.maxReviews}`,
  ];
  if (!FLAGS.includeCurated) conds.push(`v.source <> 'curated'`);
  if (FLAGS.city) conds.push(`c.slug = '${FLAGS.city.replace(/'/g, '')}'`);

  const rows = await ds.query(`
    SELECT c.name AS city, v.category, v.name, v.slug,
           COALESCE(v.external_review_count, 0)::int AS reviews,
           COALESCE(v.rating, 0)::numeric(3,2) AS rating
    FROM venues v JOIN cities c ON c.id = v.city_id
    WHERE ${conds.join(' AND ')}
    ORDER BY c.name, v.external_review_count`);

  console.log(`\nSuspicious ${FLAGS.rating.toFixed(1)}★ venues with < ${FLAGS.maxReviews} reviews`);
  console.log(`Scope: ${FLAGS.includeCurated ? 'all sources' : 'non-curated only'}${FLAGS.city ? `, city=${FLAGS.city}` : ''}\n`);
  console.table(rows);

  // Per-city breakdown
  const byCity = await ds.query(`
    SELECT c.name AS city, COUNT(*)::int AS cnt
    FROM venues v JOIN cities c ON c.id = v.city_id
    WHERE ${conds.join(' AND ')}
    GROUP BY c.name ORDER BY cnt DESC`);
  console.log('Per-city:');
  console.table(byCity);

  console.log(`\nTotal: ${rows.length} venues`);

  if (FLAGS.apply && rows.length > 0) {
    const slugs = rows.map((r: { slug: string }) => r.slug);
    // softDelete by slug list — TypeORM accepts an array of WHERE objects
    // for OR-equality. One UPDATE statement, sets deleted_at = now() on all
    // matched rows. Reversible via UPDATE … SET deleted_at = NULL.
    const targets = await ds.getRepository(Venue).find({
      where: slugs.map((s) => ({ slug: s })),
      select: { id: true },
    });
    await ds.getRepository(Venue).softDelete(targets.map((v) => v.id));
    console.log(`\n✓ Soft-deleted ${targets.length} venues`);
  } else if (!FLAGS.apply && rows.length > 0) {
    console.log(`\n(read-only — pass --apply to soft-delete)`);
  }

  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
