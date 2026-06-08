import 'reflect-metadata';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { DataSource, In } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue } from './entities';

dotenv.config();

// HARD delete suspicious "5★ + few-reviews" venues AND unlink their image
// files from the upload volume. Same selector as _diag-suspicious-five-star.ts
// — uses softDelete by default; this one is the nuclear option:
//   1. Pull all candidates + their image URLs.
//   2. POST images to /admin/uploads/by-urls to unlink from volume.
//   3. DELETE FROM venues — cascades to reviews/votes/check_ins/saved_venues
//      via FK ON DELETE CASCADE, leaving zero orphans.
//
// SAFETY: dry-run by default. Pass --apply.
// IRREVERSIBLE: there is no undo — the rows are gone and the files are
// gone. Run the soft-delete script first if you're not sure.
//
//   npx ts-node src/database/_diag-hard-delete-suspicious.ts                    (dry-run)
//   npx ts-node src/database/_diag-hard-delete-suspicious.ts --apply
//   npx ts-node src/database/_diag-hard-delete-suspicious.ts --city=quang-ninh --apply
//   npx ts-node src/database/_diag-hard-delete-suspicious.ts --max-reviews=20 --apply

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
  batchSize: parseInt(arg('batch-size', '50'), 10),
};

const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const ADMIN_JWT = process.env.IMPORT_ADMIN_JWT ?? '';

async function unlinkFiles(urls: string[]): Promise<{ removed: number; submitted: number }> {
  if (urls.length === 0) return { removed: 0, submitted: 0 };
  const res = await axios.delete<{ removed: number; submitted: number }>(
    `${BACKEND}/admin/uploads/by-urls`,
    {
      data: { urls },
      headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      timeout: 60000,
    },
  );
  return res.data;
}

async function main(): Promise<void> {
  if (FLAGS.apply && (!BACKEND || !ADMIN_JWT)) {
    throw new Error('BACKEND_PUBLIC_URL + IMPORT_ADMIN_JWT required for --apply');
  }

  console.log(
    `\n${FLAGS.apply ? '🔴 APPLY (IRREVERSIBLE)' : '🟡 DRY-RUN'} — hard-delete suspicious ${FLAGS.rating.toFixed(1)}★ venues with reviews < ${FLAGS.maxReviews}`,
  );
  console.log(`Scope: ${FLAGS.includeCurated ? 'all sources' : 'non-curated only'}${FLAGS.city ? `, city=${FLAGS.city}` : ''}\n`);

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

  const rows: Array<{ id: string; slug: string; name: string; city: string; images: string[] }> = await ds.query(`
    SELECT v.id, v.slug, v.name, c.name AS city, v.images
    FROM venues v JOIN cities c ON c.id = v.city_id
    WHERE ${conds.join(' AND ')}
    ORDER BY c.name, v.name`);

  if (rows.length === 0) {
    console.log('  (nothing to delete)');
    await ds.destroy();
    return;
  }

  // Collect every owned upload URL (files we'll actually unlink). Foreign
  // URLs (Google, Unsplash) are dropped — only files on OUR disk volume.
  const ownedUrls: string[] = [];
  for (const r of rows) {
    for (const url of r.images ?? []) {
      if (typeof url !== 'string') continue;
      try {
        const p = url.startsWith('/') ? url : new URL(url).pathname;
        if (p.startsWith('/uploads/')) ownedUrls.push(url);
      } catch { /* skip malformed */ }
    }
  }

  console.log(`Targets: ${rows.length} venues, ${ownedUrls.length} owned image files`);
  console.log('\nFirst 10:');
  for (const r of rows.slice(0, 10)) {
    console.log(`  - [${r.city}] ${r.name}  (${(r.images ?? []).length} imgs)`);
  }
  if (rows.length > 10) console.log(`  … and ${rows.length - 10} more`);

  if (!FLAGS.apply) {
    console.log(`\n(dry-run — pass --apply to actually delete)`);
    await ds.destroy();
    return;
  }

  // Step 1: unlink files in batches (so a 500-URL nuke doesn't blow request
  // size limits on the backend).
  console.log('\nStep 1: unlinking files…');
  let totalRemoved = 0;
  for (let i = 0; i < ownedUrls.length; i += FLAGS.batchSize) {
    const batch = ownedUrls.slice(i, i + FLAGS.batchSize);
    try {
      const res = await unlinkFiles(batch);
      totalRemoved += res.removed;
      process.stdout.write(`  ${i + batch.length}/${ownedUrls.length} — ${res.removed}/${res.submitted} unlinked\r`);
    } catch (e) {
      console.log(`\n  ✗ batch ${i}-${i + batch.length} failed: ${String(e).slice(0, 120)}`);
    }
  }
  console.log(`\n  ✓ ${totalRemoved}/${ownedUrls.length} files unlinked from volume`);

  // Step 2: hard delete venue rows. FK ON DELETE CASCADE on reviews,
  // votes, check_ins, journey_entries, saved_venues handles dependents.
  console.log('\nStep 2: hard-deleting venue rows…');
  const venueIds = rows.map((r) => r.id);
  const res = await ds.getRepository(Venue).delete({ id: In(venueIds) });
  console.log(`  ✓ ${res.affected ?? 0} venue rows deleted (cascades to reviews/votes/saves)`);

  console.log('\n✓ DONE');
  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
