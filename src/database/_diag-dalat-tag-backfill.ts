import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue, City } from './entities';

dotenv.config();

// Backfills empty-tag venues in Đà Lạt with a category-derived default tag,
// so facet filtering + AI search can find them. Dry-run by default.

const APPLY = process.argv.includes('--apply');

const DEFAULT_TAGS_BY_CATEGORY: Record<string, string[]> = {
  cafe: ['Quán cà phê'],
  restaurant: ['Nhà hàng'],
  street_food: ['Ẩm thực đường phố'],
  viewpoint: ['Điểm thu hút khách du lịch'],
  beach: ['Bãi biển'],
  homestay: ['Homestay'],
  bar: ['Quán bar'],
  museum: ['Bảo tàng'],
  park: ['Công viên'],
  shopping: ['Mua sắm'],
};

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const cityRepo = ds.getRepository(City);
  const venueRepo = ds.getRepository(Venue);

  const dalat = await cityRepo.findOne({ where: { slug: 'da-lat' } });
  if (!dalat) throw new Error('Đà Lạt city not found');

  const venues = await venueRepo.createQueryBuilder('v')
    .where('v.cityId = :cid', { cid: dalat.id })
    .andWhere('v.deletedAt IS NULL')
    .andWhere('COALESCE(array_length(v.tags, 1), 0) = 0')
    .getMany();

  console.log(`${APPLY ? '🔴 APPLY' : '🟡 DRY-RUN'}: ${venues.length} Đà Lạt venues with empty tags`);

  const byCat: Record<string, number> = {};
  for (const v of venues) {
    const defaults = DEFAULT_TAGS_BY_CATEGORY[v.category] ?? [v.category];
    byCat[v.category] = (byCat[v.category] ?? 0) + 1;
    if (APPLY) await venueRepo.update({ id: v.id }, { tags: defaults });
  }

  console.log('By category:');
  for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(14)} ${n}  → tags=${JSON.stringify(DEFAULT_TAGS_BY_CATEGORY[c])}`);
  }

  console.log(APPLY ? '\n✓ APPLIED' : '\n(dry-run — pass --apply to commit)');
  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
