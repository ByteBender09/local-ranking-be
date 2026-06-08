import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';

dotenv.config();

// Read-only quality monitor. Run periodically (or after big imports) to catch
// the failure modes the 2026-06 audit uncovered:
//   - beach venues in inland cities
//   - categories with high empty-tag rates
//   - cafe outliers (city with >3× the median of others)
//   - low-quality non-curated leftovers (reviews<100 AND rating<4.0)
//   - rooftop tag literals still in the wild
// Exits 1 if any alert fires — wire into CI/cron if you want hard guards.

const INLAND_SLUGS = ['da-lat', 'ha-noi', 'sa-pa', 'ninh-binh'];
let alerts = 0;

function alert(msg: string): void {
  console.log(`  ⚠ ${msg}`);
  alerts++;
}

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();

  console.log('=== Category quality monitor ===\n');

  console.log('● Inland beach venues (should be 0)');
  const inlandBeach = await ds.query(`
    SELECT c.name as city, COUNT(*)::int as cnt
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.category='beach' AND v.deleted_at IS NULL
      AND c.slug = ANY($1::text[])
    GROUP BY c.name ORDER BY cnt DESC`, [INLAND_SLUGS]);
  if (inlandBeach.length === 0) console.log('  ✓ none');
  else for (const r of inlandBeach) alert(`${r.city}: ${r.cnt} beach venues`);

  console.log('\n● Categories with >30% empty-tag rate');
  const emptyTag = await ds.query(`
    SELECT c.name as city, v.category,
           COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE COALESCE(array_length(v.tags,1),0)=0)::int as empty
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL
    GROUP BY c.name, v.category
    HAVING COUNT(*) >= 5 AND (COUNT(*) FILTER (WHERE COALESCE(array_length(v.tags,1),0)=0))::float / COUNT(*) > 0.30
    ORDER BY (COUNT(*) FILTER (WHERE COALESCE(array_length(v.tags,1),0)=0))::float / COUNT(*) DESC`);
  if (emptyTag.length === 0) console.log('  ✓ none');
  else for (const r of emptyTag) alert(`${r.city} / ${r.category}: ${r.empty}/${r.total} empty tags`);

  console.log('\n● Cafe outlier cities (>3× median of others)');
  const cafeCounts = await ds.query(`
    SELECT c.name as city, COUNT(*)::int as cnt
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.category='cafe' AND v.deleted_at IS NULL
    GROUP BY c.name`);
  const cnts = cafeCounts.map((r: { cnt: number }) => r.cnt).sort((a: number, b: number) => a - b);
  const median = cnts[Math.floor(cnts.length / 2)];
  const outliers = cafeCounts.filter((r: { cnt: number }) => r.cnt > median * 3);
  if (outliers.length === 0) console.log(`  ✓ none (median=${median})`);
  else for (const r of outliers) alert(`${r.city}: ${r.cnt} cafes (median=${median}, ratio=${(r.cnt / median).toFixed(1)}×)`);

  console.log('\n● Low-quality non-curated leftovers (reviews<100 AND rating<4)');
  const lowQ = await ds.query(`
    SELECT c.name as city, COUNT(*)::int as cnt
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL AND v.is_published=true
      AND v.source<>'curated'
      AND COALESCE(v.external_review_count,0)<100
      AND COALESCE(v.rating,0)<4.0
    GROUP BY c.name ORDER BY cnt DESC`);
  if (lowQ.length === 0) console.log('  ✓ none');
  else for (const r of lowQ) alert(`${r.city}: ${r.cnt} low-quality venues left`);

  console.log('\n● Rooftop tag literals still present');
  const rooftop = await ds.query(`
    SELECT v.name, c.name as city, v.tags
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL
      AND v.tags && ARRAY['rooftop','Quán bar trên sân thượng']::text[]`);
  if (rooftop.length === 0) console.log('  ✓ none');
  else for (const r of rooftop) alert(`${r.city} / ${r.name}: tags=${JSON.stringify(r.tags)}`);

  console.log('\n● Hotel/apartment-tagged venues outside category=homestay');
  const hotels = await ds.query(`
    SELECT c.name as city, v.category, COUNT(*)::int as cnt
    FROM venues v JOIN cities c ON c.id=v.city_id
    WHERE v.deleted_at IS NULL AND v.is_published=true
      AND v.category<>'homestay'
      AND v.tags && ARRAY['Khách sạn','Căn hộ nghỉ mát','Resort','Khu nghỉ dưỡng','Nhà nghỉ','Khu nghỉ mát','Khách sạn 5 sao','Khách sạn 4 sao','Khách sạn 3 sao']
    GROUP BY c.name, v.category ORDER BY cnt DESC`);
  if (hotels.length === 0) console.log('  ✓ none');
  else for (const r of hotels) alert(`${r.city} / ${r.category}: ${r.cnt} hotel-tagged`);

  console.log(`\n${alerts === 0 ? '✓ all clear' : `⚠ ${alerts} alert(s)`}`);
  await ds.destroy();
  if (alerts > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
