import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/database/data-source';
import {
  resolveWardFromVenue,
  toNormalizable,
  normalize,
  type NormalizableWard,
} from '../src/modules/venues/ward-resolver';
import { Ward } from '../src/database/entities';

dotenv.config();

interface Row {
  id: string; city_slug: string; name: string; district: string | null;
  address: string; source: string;
}

async function main() {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();

  // Load ward index per city
  const allWards = await ds.getRepository(Ward).find({ relations: ['city'] });
  const wardsByCity = new Map<string, NormalizableWard[]>();
  for (const w of allWards) {
    const slug = w.city.slug;
    const list = wardsByCity.get(slug) ?? [];
    list.push(...toNormalizable([{
      name: w.name,
      type: w.type as 'phuong' | 'xa' | 'dac_khu',
      aliasesOldDistrict: w.aliasesOldDistrict ?? [],
      aliasesOldWards: w.aliasesOldWards ?? [],
      aliasesUser: w.aliasesUser ?? [],
    }]));
    wardsByCity.set(slug, list);
  }

  console.log(`Ward index: ${allWards.length} wards across ${wardsByCity.size} cities\n`);

  const venues: Row[] = await ds.query(
    `SELECT v.id, c.slug AS city_slug, v.name, v.district, v.address, v.source
     FROM venues v JOIN cities c ON c.id = v.city_id
     WHERE v.deleted_at IS NULL
       AND (v.ward_canonical IS NULL OR v.ward_canonical = '')
     ORDER BY c.slug, v.name`,
  );

  // Group by (city, district) to make the report scannable
  const byKey = new Map<string, { rows: Row[]; reason: string }>();
  for (const v of venues) {
    const wards = wardsByCity.get(v.city_slug) ?? [];
    const result = resolveWardFromVenue(v.district, v.address, wards);

    // If the resolver suddenly finds a match now, the row just hasn't been
    // re-resolved since the seed was edited — flag as "fixable by retry".
    let reason: string;
    if (result) {
      reason = `RESOLVABLE NOW → ${result.wardCanonical} (${result.method}) — needs re-run`;
    } else {
      // Inspect why it failed
      const rawNorm = normalize(v.district ?? '');
      if (!v.district) reason = 'district empty';
      else if (wards.length === 0) reason = 'no wards seeded for this city';
      else {
        // Does any ward have this normalized name?
        const nameMatch = wards.some((w) => w.nameNorm === rawNorm);
        const aliasMatch = wards.some((w) => w.aliasesNorm.includes(rawNorm));
        if (nameMatch || aliasMatch) {
          reason = 'should match but resolver says no (bug?)';
        } else {
          reason = `not in ward index for ${v.city_slug} — district "${v.district}" → norm "${rawNorm}"`;
        }
      }
    }

    const key = `${v.city_slug} ▸ ${v.district || '(empty)'}`;
    const entry = byKey.get(key) ?? { rows: [], reason };
    entry.rows.push(v);
    byKey.set(key, entry);
  }

  console.log(`=== ${venues.length} venues with NULL ward — grouped by (city, district) ===\n`);
  // Sort by count desc
  const groups = [...byKey.entries()].sort((a, b) => b[1].rows.length - a[1].rows.length);
  for (const [key, { rows, reason }] of groups) {
    console.log(`▸ ${key}  (${rows.length} venues)`);
    console.log(`  reason: ${reason}`);
    for (const r of rows.slice(0, 3)) {
      console.log(`    · ${r.name}  [${r.source}]`);
      console.log(`      address: ${(r.address || '').slice(0, 110)}`);
    }
    if (rows.length > 3) console.log(`    · … ${rows.length - 3} more`);
    console.log('');
  }

  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
