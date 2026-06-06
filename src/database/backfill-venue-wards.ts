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
import {
  resolveByNearestAnchor,
  type AnchorPoint,
} from '../modules/venues/ward-geo-resolver';

// One-shot backfill: resolves every published venue's raw `district` to a
// canonical post-2025 ward and writes ward_canonical / ward_type /
// ward_resolution_method. Safe to re-run — only updates rows where the
// resolved value differs from what's already stored (so a re-run after
// expanding aliases in the seed files updates exactly the rows that
// flipped).
//
// Defaults to DRY RUN. Pass `--apply` to actually write. Always prints a
// per-city coverage report so the operator can sanity-check before/after.
//
//   npx ts-node -r tsconfig-paths/register src/database/backfill-venue-wards.ts
//   npx ts-node -r tsconfig-paths/register src/database/backfill-venue-wards.ts --apply

interface VenueRow {
  id: string;
  city_slug: string;
  district: string | null;
  address: string | null;
  lat: number;
  lng: number;
  ward_canonical: string | null;
  ward_type: string | null;
  ward_resolution_method: string | null;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();

  const wardRepo = ds.getRepository(Ward);
  const wardEntities = await wardRepo
    .createQueryBuilder('w')
    .innerJoin('w.city', 'c')
    .select(['w.name', 'w.type', 'w.aliasesOldDistrict', 'w.aliasesOldWards', 'w.aliasesUser'])
    .addSelect('c.slug', 'city_slug')
    .getRawAndEntities();

  const wardsByCity = new Map<string, NormalizableWard[]>();
  for (let i = 0; i < wardEntities.entities.length; i++) {
    const w = wardEntities.entities[i];
    const slug = wardEntities.raw[i].city_slug as string;
    const list = wardsByCity.get(slug) ?? [];
    list.push(
      ...toNormalizable([
        {
          name: w.name,
          type: w.type,
          aliasesOldDistrict: w.aliasesOldDistrict,
          aliasesOldWards: w.aliasesOldWards,
          aliasesUser: w.aliasesUser,
        },
      ]),
    );
    wardsByCity.set(slug, list);
  }
  console.log(
    `Loaded ${wardEntities.entities.length} wards across ${wardsByCity.size} cities`,
  );
  console.log(apply ? `Mode: APPLY (writes to DB)` : `Mode: DRY RUN (no writes)\n`);

  const venues = await ds.query<VenueRow[]>(
    `SELECT v.id, c.slug AS city_slug, v.district, v.address, v.lat, v.lng,
            v.ward_canonical, v.ward_type, v.ward_resolution_method
     FROM venues v JOIN cities c ON c.id = v.city_id
     WHERE v.is_published = true`,
  );

  // Two-pass design: Stage 1+2 (text-based) runs first; Stage 3 (nearest-
  // neighbor geo) runs only after the text pass so it can use the just-
  // resolved venues as anchor points. The anchors are accumulated PER CITY
  // so a venue in HCM never gets matched to a Hanoi anchor.
  const stagedDecisions = new Map<
    string,
    { wardCanonical: string; wardType: string; method: string } | null
  >();
  const anchorsByCity = new Map<string, AnchorPoint[]>();

  let resolved = 0;
  let unresolved = 0;
  let changed = 0;
  let unchanged = 0;
  const perCity = new Map<string, { resolved: number; total: number; geo: number }>();

  // ─── Pass 1: text-based resolution (Stage 1+2) ──────────────────
  for (const v of venues) {
    const wards = wardsByCity.get(v.city_slug) ?? [];
    const r = resolveWardFromVenue(v.district, v.address, wards);
    if (r) {
      stagedDecisions.set(v.id, {
        wardCanonical: r.wardCanonical,
        wardType: r.wardType,
        method: r.method,
      });
      // Become an anchor for Stage 3 — but only if the venue has real
      // coordinates. (0,0) sneaked through somehow → drop it.
      if (Number.isFinite(v.lat) && Number.isFinite(v.lng) && (v.lat !== 0 || v.lng !== 0)) {
        const list = anchorsByCity.get(v.city_slug) ?? [];
        list.push({
          wardCanonical: r.wardCanonical,
          wardType: r.wardType,
          lat: v.lat,
          lng: v.lng,
        });
        anchorsByCity.set(v.city_slug, list);
      }
    } else {
      stagedDecisions.set(v.id, null);
    }
  }

  // ─── Pass 2: nearest-neighbor geo for whatever text missed ──────
  let geoFilled = 0;
  for (const v of venues) {
    if (stagedDecisions.get(v.id) !== null) continue;
    const anchors = anchorsByCity.get(v.city_slug) ?? [];
    const r = resolveByNearestAnchor(v.lat, v.lng, anchors);
    if (r) {
      stagedDecisions.set(v.id, {
        wardCanonical: r.wardCanonical,
        wardType: r.wardType,
        method: r.method,
      });
      geoFilled++;
    }
  }

  // ─── Pass 3: write decisions to DB ──────────────────────────────
  // Single UPDATE per row — fine for 1844 venues. At 10x scale we'd
  // switch to chunked UPDATE ... FROM (VALUES ...) batches.
  for (const v of venues) {
    const decision = stagedDecisions.get(v.id) ?? null;
    const stat = perCity.get(v.city_slug) ?? { resolved: 0, total: 0, geo: 0 };
    stat.total++;
    if (decision) {
      resolved++;
      stat.resolved++;
      if (decision.method === 'geo') stat.geo++;
      const flipped =
        v.ward_canonical !== decision.wardCanonical ||
        v.ward_type !== decision.wardType ||
        v.ward_resolution_method !== decision.method;
      if (flipped) {
        changed++;
        if (apply) {
          await ds.query(
            `UPDATE venues
             SET ward_canonical = $1, ward_type = $2, ward_resolution_method = $3
             WHERE id = $4`,
            [decision.wardCanonical, decision.wardType, decision.method, v.id],
          );
        }
      } else {
        unchanged++;
      }
    } else {
      unresolved++;
      if (v.ward_canonical !== null) {
        changed++;
        if (apply) {
          await ds.query(
            `UPDATE venues
             SET ward_canonical = NULL, ward_type = NULL, ward_resolution_method = NULL
             WHERE id = $1`,
            [v.id],
          );
        }
      }
    }
    perCity.set(v.city_slug, stat);
  }
  console.log(`Stage 3 (nearest-neighbor geo) filled ${geoFilled} additional venues\n`);

  console.log(`═══ Per-city coverage ═══`);
  for (const slug of [...perCity.keys()].sort()) {
    const s = perCity.get(slug)!;
    const pct = ((s.resolved / s.total) * 100).toFixed(1);
    const geoNote = s.geo > 0 ? ` (geo=${s.geo})` : '';
    console.log(`  ${slug.padEnd(12)} ${s.resolved}/${s.total} (${pct}%)${geoNote}`);
  }

  console.log(
    `\nTotal venues:      ${venues.length}\n` +
      `Resolved:          ${resolved} (${((resolved / venues.length) * 100).toFixed(1)}%)\n` +
      `Unresolved:        ${unresolved}\n` +
      `Rows changed:      ${changed}\n` +
      `Rows unchanged:    ${unchanged}\n` +
      (apply ? `Writes APPLIED.` : `Dry run — pass --apply to write.`),
  );

  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
