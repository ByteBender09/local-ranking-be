import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { City, Ward } from './entities';
import { ALL_DESTINATION_SEEDS } from './ward-seed';

// Upserts the canonical post-2025 ward dataset into the `wards` table from
// the TypeScript seed files under ./ward-seed. Idempotent — safe to re-run
// after editing any seed file. The unique key (city_id, name) drives the
// upsert; aliases get fully replaced on each run so removing a stale alias
// in source actually takes effect.
//
// Run: npx ts-node -r tsconfig-paths/register src/database/seed-wards.ts
async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const cityRepo = ds.getRepository(City);
  const wardRepo = ds.getRepository(Ward);

  // Build city slug → id map upfront. If a seed file names a city that doesn't
  // exist in the cities table the script fails loudly rather than silently
  // skipping rows — much easier to debug.
  const cities = await cityRepo.find();
  const cityIdBySlug = new Map(cities.map((c) => [c.slug, c.id] as const));

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;

  for (const seed of ALL_DESTINATION_SEEDS) {
    const cityId = cityIdBySlug.get(seed.citySlug);
    if (!cityId) {
      throw new Error(
        `Seed references unknown city slug "${seed.citySlug}". ` +
          `Either add the city to the cities table or remove the seed file.`,
      );
    }

    // Detect duplicate ward names within a single seed file before hitting
    // the unique constraint — the migration sets uq_wards_city_name and
    // Postgres will reject the second insert with an opaque error otherwise.
    const seenNames = new Set<string>();
    for (const w of seed.wards) {
      if (seenNames.has(w.name)) {
        throw new Error(
          `Duplicate ward name "${w.name}" in seed for "${seed.citySlug}". ` +
            `Each (city, ward name) pair must be unique.`,
        );
      }
      seenNames.add(w.name);
    }

    const existing = await wardRepo.find({ where: { cityId } });
    const existingByName = new Map(existing.map((w) => [w.name, w] as const));

    for (const wSeed of seed.wards) {
      const found = existingByName.get(wSeed.name);
      if (found) {
        found.type = wSeed.type;
        found.aliasesOldDistrict = wSeed.aliasesOldDistrict ?? [];
        found.aliasesOldWards = wSeed.aliasesOldWards ?? [];
        found.aliasesUser = wSeed.aliasesUser ?? [];
        await wardRepo.save(found);
        totalUpdated++;
        existingByName.delete(wSeed.name);
      } else {
        await wardRepo.save(
          wardRepo.create({
            cityId,
            name: wSeed.name,
            type: wSeed.type,
            aliasesOldDistrict: wSeed.aliasesOldDistrict ?? [],
            aliasesOldWards: wSeed.aliasesOldWards ?? [],
            aliasesUser: wSeed.aliasesUser ?? [],
          }),
        );
        totalInserted++;
      }
    }

    // Anything left in existingByName is a ward in DB that's no longer in
    // the seed file — delete it. Wards in DB are seed-driven, not user-
    // generated, so this is the right behavior.
    for (const stale of existingByName.values()) {
      await wardRepo.delete(stale.id);
      totalDeleted++;
    }

    console.log(
      `  ${seed.citySlug}: ${seed.wards.length} wards seeded ` +
        `(${existing.length} existed)`,
    );
  }

  console.log(
    `\nDone — inserted: ${totalInserted}, updated: ${totalUpdated}, deleted: ${totalDeleted}`,
  );
  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
