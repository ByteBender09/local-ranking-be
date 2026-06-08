import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
dotenv.config();

async function main() {
  const ds = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL, ssl: false } as any);
  await ds.initialize();
  // Venues whose tags include any literal containing "rooftop" or "sân thượng" or "sky"
  const rows = await ds.query(`
    SELECT c.name as city, v.category, v.name,
      ARRAY(SELECT t FROM unnest(v.tags) t WHERE t ILIKE '%rooftop%' OR t ILIKE '%sân thượng%' OR t ILIKE '%sky bar%' OR t = 'Quán bar trên sân thượng') as match_tags,
      v.tags as all_tags
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM unnest(v.tags) t WHERE t ILIKE '%rooftop%' OR t ILIKE '%sân thượng%' OR t ILIKE '%sky bar%' OR t = 'Quán bar trên sân thượng')
    ORDER BY c.name, v.name`);
  console.log('Venues with rooftop-style tag literals:', rows.length);
  for (const r of rows) {
    console.log(`  [${r.city}] (${r.category}) ${r.name} :: matched=${JSON.stringify(r.match_tags)} all=${JSON.stringify(r.all_tags)}`);
  }
  await ds.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
