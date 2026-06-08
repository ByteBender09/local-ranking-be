import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config();

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: false,
  } as any);
  await ds.initialize();

  console.log('\n=== TOTAL venues by city / source ===');
  const total = await ds.query(`
    SELECT c.name as city,
           COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE v.source='curated')::int as curated,
           COUNT(*) FILTER (WHERE v.source='google')::int as google
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL AND v.is_published=true
    GROUP BY c.name ORDER BY c.name`);
  console.table(total);

  console.log('\n=== Beach venues in inland cities (mis-categorized) ===');
  const inlandBeach = await ds.query(`
    SELECT c.name as city, COUNT(*)::int as cnt
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.category='beach' AND v.deleted_at IS NULL
      AND c.slug IN ('da-lat','ha-noi','sa-pa','ninh-binh','hue')
    GROUP BY c.name ORDER BY cnt DESC`);
  console.table(inlandBeach);

  console.log('\n=== Bar variants per city (sum of bar-related tags) ===');
  const barAll = await ds.query(`
    SELECT c.name as city,
           COUNT(*) FILTER (WHERE v.category='bar')::int as cat_bar,
           COUNT(*) FILTER (
             WHERE v.tags && ARRAY['Quán bar','Quán bar cocktail','Quán bia','Quán rượu','Hộp đêm','Quán bar karaoke','Quán bar trên sân thượng','Quán bia sân vườn']
           )::int as has_bar_tag
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL
    GROUP BY c.name ORDER BY c.name`);
  console.table(barAll);

  console.log('\n=== Top-rated venues not yet categorized as bar but tagged bar-like ===');
  const barHidden = await ds.query(`
    SELECT c.name as city, v.category, v.name, v.tags, v.external_review_count as rvw
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL AND v.category<>'bar'
      AND v.tags && ARRAY['Quán bar','Quán bar cocktail','Hộp đêm','Quán bar karaoke','Quán bar trên sân thượng']
    ORDER BY v.external_review_count DESC NULLS LAST LIMIT 30`);
  console.table(barHidden);

  console.log('\n=== Cafe coverage per city ===');
  const cafe = await ds.query(`
    SELECT c.name as city, COUNT(*)::int as cnt
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.category='cafe' AND v.deleted_at IS NULL
    GROUP BY c.name ORDER BY cnt DESC`);
  console.table(cafe);

  console.log('\n=== Viewpoint coverage per city ===');
  const view = await ds.query(`
    SELECT c.name as city, COUNT(*)::int as cnt
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.category='viewpoint' AND v.deleted_at IS NULL
    GROUP BY c.name ORDER BY cnt DESC`);
  console.table(view);

  console.log('\n=== Homestay coverage per city ===');
  const home = await ds.query(`
    SELECT c.name as city, COUNT(*)::int as cnt
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.category='homestay' AND v.deleted_at IS NULL
    GROUP BY c.name ORDER BY cnt DESC`);
  console.table(home);

  console.log('\n=== Distribution of tag "phố đi bộ" / walking street venues ===');
  const walk = await ds.query(`
    SELECT c.name as city, v.category, COUNT(*)::int as cnt
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL
      AND (v.tags && ARRAY['phố đi bộ','Khu vực đi bộ','Phố','Street','Phố cổ'] OR v.name ILIKE '%phố%' OR v.name ILIKE '%đường%đi bộ%')
    GROUP BY c.name, v.category ORDER BY c.name, cnt DESC`);
  console.table(walk);

  console.log('\n=== Venues with empty tags by city/category ===');
  const noTags = await ds.query(`
    SELECT c.name as city, v.category, COUNT(*)::int as no_tags
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL AND COALESCE(array_length(v.tags,1),0)=0
    GROUP BY c.name, v.category ORDER BY no_tags DESC LIMIT 25`);
  console.table(noTags);

  console.log('\n=== Avg external review count per city (low = thin data) ===');
  const reviews = await ds.query(`
    SELECT c.name as city,
           AVG(v.external_review_count)::int as avg_reviews,
           PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY v.external_review_count)::int as median_reviews
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL
    GROUP BY c.name ORDER BY c.name`);
  console.table(reviews);

  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
