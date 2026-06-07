import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue } from './entities';

(async () => {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const v = await ds.getRepository(Venue).findOne({
    where: { slug: 'yen-sao-khanh-hoa-sanest-tourist-nha-trang' },
  });
  if (!v) {
    console.log('not found');
  } else {
    console.log('rating:', v.rating);
    console.log('externalRating:', v.externalRating);
    console.log('externalReviewCount:', v.externalReviewCount);
    console.log('externalSyncedAt:', v.externalSyncedAt);
    console.log('externalId:', v.externalId);
    console.log('address:', v.address);
    console.log('lat,lng:', v.lat, v.lng);
    console.log('images count:', v.images?.length ?? 0);
    console.log('first image:', v.images?.[0] ?? '(none)');
  }
  await ds.destroy();
})();
