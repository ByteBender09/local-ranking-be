import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Ward } from './entities';
import {
  resolveWardFromVenue,
  toNormalizable,
  type NormalizableWard,
} from '../modules/venues/ward-resolver';

// Dry-run the ward resolver against every published venue and report
// coverage % per city + samples of unresolved rows. Uses the SAME logic
// as the backfill script (resolveWardFromVenue — district first, then
// address fallback) so its numbers match what backfill --apply would write.
// Never touches the DB. Run BEFORE the real backfill to validate seed
// changes; re-run AFTER to confirm.
//
//   npx ts-node -r tsconfig-paths/register src/database/_diag-ward-normalize.ts

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();

  const wardRepo = ds.getRepository(Ward);
  const rawWards = await wardRepo
    .createQueryBuilder('w')
    .innerJoin('w.city', 'c')
    .select(['w.name', 'w.type', 'w.aliasesOldDistrict', 'w.aliasesOldWards', 'w.aliasesUser'])
    .addSelect('c.slug', 'city_slug')
    .getRawAndEntities();

  const wardsByCity = new Map<string, NormalizableWard[]>();
  for (let i = 0; i < rawWards.entities.length; i++) {
    const w = rawWards.entities[i];
    const slug = rawWards.raw[i].city_slug as string;
    const list = wardsByCity.get(slug) ?? [];
    list.push(...toNormalizable([w]));
    wardsByCity.set(slug, list);
  }
  console.log(`Loaded ${rawWards.entities.length} wards across ${wardsByCity.size} cities\n`);

  const venues = await ds.query<
    { id: string; city_slug: string; district: string | null; address: string | null }[]
  >(
    `SELECT v.id, c.slug AS city_slug, v.district, v.address
     FROM venues v JOIN cities c ON c.id = v.city_id
     WHERE v.is_published = true`,
  );
  console.log(`Total published venues: ${venues.length}\n`);

  type CityStat = {
    total: number;
    resolved: number;
    byMethod: Map<string, number>;
    unresolved: string[];
  };
  const perCity = new Map<string, CityStat>();
  for (const v of venues) {
    const slot: CityStat = perCity.get(v.city_slug) ?? {
      total: 0,
      resolved: 0,
      byMethod: new Map<string, number>(),
      unresolved: [],
    };
    slot.total++;
    const wards = wardsByCity.get(v.city_slug) ?? [];
    const r = resolveWardFromVenue(v.district, v.address, wards);
    if (r) {
      slot.resolved++;
      // Distinguish address-fallback from district-direct by checking the
      // matchedVia prefix the resolver attaches.
      const method = r.matchedVia?.startsWith('address:') ? `${r.method}-addr` : r.method;
      slot.byMethod.set(method, (slot.byMethod.get(method) ?? 0) + 1);
    } else {
      if (slot.unresolved.length < 20) slot.unresolved.push(v.district || '<null>');
    }
    perCity.set(v.city_slug, slot);
  }

  const cities = [...perCity.keys()].sort();
  let totalAll = 0;
  let resolvedAll = 0;
  console.log('═══ Coverage by city ═══');
  for (const slug of cities) {
    const s = perCity.get(slug)!;
    totalAll += s.total;
    resolvedAll += s.resolved;
    const pct = ((s.resolved / s.total) * 100).toFixed(1);
    const methods = [...s.byMethod.entries()].map(([m, n]) => `${m}=${n}`).join(' ');
    console.log(
      `  ${slug.padEnd(12)} ${s.resolved}/${s.total} (${pct}%)  ${methods}`,
    );
  }
  const pctAll = ((resolvedAll / totalAll) * 100).toFixed(1);
  console.log(`\nTOTAL: ${resolvedAll}/${totalAll} (${pctAll}%) resolved\n`);

  console.log('═══ Sample unresolved (raw district strings) per city ═══');
  for (const slug of cities) {
    const s = perCity.get(slug)!;
    if (s.unresolved.length === 0) continue;
    const dropped = s.total - s.resolved;
    console.log(`\n  ${slug} (${dropped} unresolved):`);
    const counts = new Map<string, number>();
    for (const u of s.unresolved) counts.set(u, (counts.get(u) ?? 0) + 1);
    for (const [val, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    "${val}" (${n})`);
    }
  }

  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
