import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue, City } from './entities';

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const repo = ds.getRepository(Venue);

  const total = await repo.count({ where: { source: 'google' } });
  const withImg = (await repo.createQueryBuilder('v')
    .where("v.source = 'google'")
    .andWhere("array_length(v.images, 1) >= 1")
    .getCount());

  const rows = await repo.createQueryBuilder('v')
    .select('c.slug', 'city').addSelect('COUNT(*)', 'n')
    .innerJoin(City, 'c', 'c.id = v.city_id')
    .where("v.source = 'google'")
    .groupBy('c.slug').orderBy('n', 'DESC')
    .getRawMany<{ city: string; n: string }>();

  console.log(`TOTAL google venues saved: ${total}`);
  console.log(`  with ≥1 image: ${withImg}  | without image: ${total - withImg}`);
  console.log('Per city:');
  for (const r of rows) console.log(`  ${r.city}: ${r.n}`);
  await ds.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
