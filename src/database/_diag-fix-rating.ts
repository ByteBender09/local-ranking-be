import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue } from './entities';

(async () => {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const repo = ds.getRepository(Venue);
  const slug = 'yen-sao-khanh-hoa-sanest-tourist-nha-trang';
  const v = await repo.findOne({ where: { slug } });
  if (!v) { console.log('not found'); await ds.destroy(); return; }
  console.log('before — rating:', v.rating, '| externalRating:', v.externalRating);
  await repo.update({ id: v.id }, { rating: v.externalRating });
  const after = await repo.findOne({ where: { id: v.id } });
  console.log('after  — rating:', after?.rating);
  await ds.destroy();
})();
