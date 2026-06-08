import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
dotenv.config();

const slugify = (s: string): string =>
  s.toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function main() {
  const ds = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL, ssl: false } as any);
  await ds.initialize();
  // Check current categorisation per city
  const counts = await ds.query(`
    SELECT c.name as city, v.category, v.source, COUNT(*)::int as cnt
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL AND v.is_published=true
    GROUP BY c.name, v.category, v.source
    ORDER BY c.name, v.category, v.source`);
  console.log('After all changes — venues per city/category/source:');
  console.table(counts);
  // Specifically Đà Nẵng cafe
  const danang = await ds.query(`
    SELECT v.name, v.source FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE c.slug='da-nang' AND v.category='cafe' AND v.deleted_at IS NULL
    ORDER BY v.source, v.name`);
  console.log('\nĐà Nẵng cafes:');
  console.table(danang);
  await ds.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
