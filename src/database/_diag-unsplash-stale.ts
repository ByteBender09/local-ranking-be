import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue, City } from './entities';

// One-off count: venues where rating<4, externalReviewCount=0, every image is unsplash.

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const repo = ds.getRepository(Venue);

  const baseWhere = `
    v.rating < 4.0
    AND v.external_review_count = 0
    AND COALESCE(array_length(v.images, 1), 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM unnest(v.images) AS img
      WHERE img NOT LIKE '%images.unsplash.com%'
    )
  `;

  const total = await repo
    .createQueryBuilder('v')
    .where(baseWhere)
    .getCount();

  const perCity = await repo
    .createQueryBuilder('v')
    .select('c.slug', 'city')
    .addSelect('COUNT(*)', 'n')
    .innerJoin(City, 'c', 'c.id = v.city_id')
    .where(baseWhere)
    .groupBy('c.slug')
    .orderBy('n', 'DESC')
    .getRawMany<{ city: string; n: string }>();

  const bySource = await repo
    .createQueryBuilder('v')
    .select('v.source', 'source')
    .addSelect('COUNT(*)', 'n')
    .where(baseWhere)
    .groupBy('v.source')
    .orderBy('n', 'DESC')
    .getRawMany<{ source: string; n: string }>();

  const totalVenues = await repo.count();

  console.log(
    `\nTOTAL venues matching (rating<4 AND ext_reviews=0 AND all images = unsplash): ${total}`,
  );
  console.log(`(out of ${totalVenues} venues in DB)\n`);
  console.log('By source:');
  for (const r of bySource) console.log(`  ${r.source}: ${r.n}`);
  console.log('\nBy city:');
  for (const r of perCity) console.log(`  ${r.city}: ${r.n}`);

  const rows = await repo
    .createQueryBuilder('v')
    .innerJoinAndSelect('v.city', 'c')
    .where(baseWhere)
    .orderBy('c.slug', 'ASC')
    .addOrderBy('v.slug', 'ASC')
    .getMany();

  console.log('\nMatched venues:');
  for (const v of rows) {
    console.log(
      `  - ${v.city?.slug ?? '?'}/${v.slug} | name="${v.name}" | rating=${v.rating} | imgs=${v.images?.length ?? 0} | source=${v.source}`,
    );
  }

  await ds.destroy();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
