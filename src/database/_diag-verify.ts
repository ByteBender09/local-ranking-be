import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue } from './entities';

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const v = await ds.getRepository(Venue).findOne({
    where: { source: 'google' },
    order: { createdAt: 'DESC' },
  });
  if (!v) { console.log('No google-sourced venue found.'); await ds.destroy(); return; }

  console.log('VENUE:', JSON.stringify({
    slug: v.slug, name: v.name, category: v.category, district: v.district,
    address: v.address, lat: v.lat, lng: v.lng,
    rating: v.rating, reviewCount: v.reviewCount,
    externalRating: v.externalRating, externalReviewCount: v.externalReviewCount,
    externalId: v.externalId, priceRange: v.priceRange, hours: v.hours,
    images: v.images,
    externalRawKeys: v.externalRaw ? Object.keys(v.externalRaw).length : 0,
    hasReviews: Array.isArray((v.externalRaw as Record<string, unknown> | null)?.reviews),
  }, null, 2));

  // Fetch each stored image back to prove it's served from our volume.
  for (const url of v.images) {
    try {
      const r = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 20000 });
      console.log(`  ✓ ${r.status} ${r.headers['content-type']} ${(r.data.byteLength / 1024).toFixed(0)}KB  ${url}`);
    } catch (e) {
      const s = axios.isAxiosError(e) ? e.response?.status : String(e);
      console.log(`  ✗ FAILED (${s})  ${url}`);
    }
  }
  await ds.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
