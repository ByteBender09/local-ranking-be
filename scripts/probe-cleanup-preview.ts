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

  console.log('\n=== Hotels/apartments to delete (non-homestay only) ===');
  const hotelDelete = await ds.query(`
    SELECT c.name as city, v.category, COUNT(*)::int as cnt
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL AND v.is_published=true
      AND v.category<>'homestay'
      AND v.tags && ARRAY[
        'Khách sạn','Căn hộ nghỉ mát','Resort','Khu nghỉ dưỡng','Nhà nghỉ',
        'Khu nghỉ mát','Khách sạn 5 sao','Khách sạn 4 sao','Khách sạn 3 sao',
        'Khách sạn 2 sao','Hotel','Boutique hotel','Khu lưu trú'
      ]
    GROUP BY c.name, v.category ORDER BY c.name, cnt DESC`);
  console.table(hotelDelete);

  console.log('\n=== Non-POI venues to delete (airports, broadcast, hospitals, schools) ===');
  const nonPoi = await ds.query(`
    SELECT c.name as city, v.name, v.tags
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL AND v.is_published=true
      AND v.tags && ARRAY[
        'Sân bay','Sân bay quốc tế','Trường quay truyền hình','Đài phát thanh',
        'Bệnh viện','Trường học','Trạm xe buýt','Trạm xăng','Bến xe',
        'Ngân hàng','Văn phòng chính phủ','Bưu điện','Đập nước'
      ]
    ORDER BY c.name LIMIT 30`);
  console.table(nonPoi);

  console.log('\n=== Beach venues in inland cities — re-categorization rules ===');
  const beachInland = await ds.query(`
    SELECT c.slug as city_slug, v.id, v.name, v.tags
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.category='beach' AND v.deleted_at IS NULL
      AND c.slug IN ('da-lat','ha-noi','sa-pa','ninh-binh','hue')
    ORDER BY c.slug, v.name`);
  console.log('Total:', beachInland.length);
  for (const row of beachInland) {
    const tags = row.tags || [];
    const name = row.name as string;
    let action = '';
    if (
      tags.includes('Khách sạn') || tags.includes('Căn hộ nghỉ mát') ||
      tags.includes('Resort') || tags.includes('Khu nghỉ dưỡng') ||
      tags.includes('Khu nghỉ mát')
    ) {
      action = 'DELETE (hotel)';
    } else if (
      tags.includes('Sân bay') || tags.includes('Sân bay quốc tế') ||
      tags.includes('Đài phát thanh') || tags.includes('Trường quay truyền hình')
    ) {
      action = 'DELETE (non-POI)';
    } else if (tags.includes('Hồ') || tags.includes('Đập nước')) {
      action = 'RE-CAT → viewpoint (lake)';
    } else if (
      tags.includes('Khu vực đi bộ') ||
      name.toLowerCase().includes('đi bộ') ||
      name.toLowerCase().includes('phố')
    ) {
      action = row.city_slug === 'hue' || row.city_slug === 'hoi-an'
        ? 'RE-CAT → street_food (walking street)'
        : 'RE-CAT → viewpoint';
    } else if (tags.includes('Công viên')) {
      action = 'RE-CAT → park';
    } else if (tags.includes('Nhà hàng')) {
      action = 'RE-CAT → restaurant';
    } else {
      action = 'RE-CAT → viewpoint (fallback)';
    }
    console.log(`  [${row.city_slug.padEnd(10)}] ${action.padEnd(35)} ${name}`);
  }

  console.log('\n=== Rooftop tag normalization preview ===');
  const rooftop = await ds.query(`
    SELECT c.name as city, v.category, v.name, v.tags
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL AND v.is_published=true
      AND (
        EXISTS (SELECT 1 FROM unnest(v.tags) t WHERE t ILIKE '%rooftop%' OR t ILIKE '%sân thượng%' OR t ILIKE '%sky bar%')
        OR v.name ILIKE '%rooftop%' OR v.name ILIKE '%sky bar%'
      )
    ORDER BY c.name, v.name`);
  console.log('Total rooftop-related venues:', rooftop.length);
  console.table(rooftop.map((r: any) => ({
    city: r.city, cat: r.category, name: r.name,
    tags: JSON.stringify(r.tags).slice(0, 80),
  })));

  console.log('\n=== Low-quality soft-delete preview (reviews<100 AND rating<4.0, non-curated) ===');
  const lowQual = await ds.query(`
    SELECT c.name as city, v.category, COUNT(*)::int as cnt
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL AND v.is_published=true
      AND v.source<>'curated'
      AND COALESCE(v.external_review_count,0)<100
      AND COALESCE(v.rating,0)<4.0
    GROUP BY c.name, v.category ORDER BY c.name`);
  console.table(lowQual);

  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
