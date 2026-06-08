import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue } from './entities';
import { imagesForVenue } from './seed-data/images';

dotenv.config();

// Restores the deterministic Unsplash image set for curated venues whose
// images[] is empty — happens when _diag-rehost-venue.ts --all got rate-
// limited mid-run and saved an empty array. Safe to re-run: only touches
// curated rows where images is empty. With SafeImage's picsum fallback,
// even if Unsplash 429s on the user side the UI still renders.

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const repo = ds.getRepository(Venue);

  const venues = await repo.createQueryBuilder('v')
    .where('v.deletedAt IS NULL')
    .andWhere(`v.source = 'curated'`)
    .andWhere('COALESCE(array_length(v.images, 1), 0) = 0')
    .getMany();

  console.log(`${APPLY ? '🔴 APPLY' : '🟡 DRY-RUN'}: ${venues.length} curated venues to restore`);

  for (const v of venues) {
    const fresh = imagesForVenue(v.category, v.slug);
    console.log(`  ${v.slug.padEnd(50)} ${v.category.padEnd(12)} → ${fresh.length} imgs`);
    if (APPLY) await repo.update({ id: v.id }, { images: fresh });
  }

  console.log(APPLY ? `\n✓ Restored ${venues.length}` : '\n(dry-run — pass --apply to commit)');
  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
