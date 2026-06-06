import { MigrationInterface, QueryRunner } from 'typeorm';

// Vietnam's July 2025 reform abolished the district level entirely. The
// scraped `venues.district` column is now a jumbled mix of pre-reform district
// names ("Quận 1"), post-reform ward names ("Phú Xuân"), and garbage from
// address-string parsing ("Road,"). This migration introduces the canonical
// ward layer:
//
//   1. `wards` — one row per post-2025 phường/xã/đặc khu the app cares about
//      (~600 rows for the 12 tourism destinations). Each row carries alias
//      arrays so the normalizer can map raw district strings back to the
//      canonical ward, and so the search API can expand "Quận 3" to "find
//      every ward that absorbed District 3 territory".
//
//   2. `venues.ward_canonical` + `ward_type` + `ward_resolution_method`
//      — the resolved ward written by WardNormalizerService at import time
//      (and by the backfill in a separate one-off script). Original `district`
//      is preserved for provenance; nothing reads it anymore.
export class AddWardsTable1780000500000 implements MigrationInterface {
  name = 'AddWardsTable1780000500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wards" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "city_id" uuid NOT NULL REFERENCES "cities"("id") ON DELETE CASCADE,
        "name" varchar(120) NOT NULL,
        "type" varchar(16) NOT NULL,
        "aliases_old_district" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "aliases_old_wards" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "aliases_user" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "bbox" double precision[],
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_wards_city_name" UNIQUE ("city_id", "name")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_wards_city" ON "wards" ("city_id")`,
    );
    // GIN indexes let the normalizer ask "which ward has this raw string in
    // any of its alias arrays?" with a single index scan instead of a seq
    // scan over every ward per venue. Critical for the 1844-venue backfill
    // and for hot-path imports.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_wards_aliases_old_district" ON "wards" USING GIN ("aliases_old_district")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_wards_aliases_old_wards" ON "wards" USING GIN ("aliases_old_wards")`,
    );

    await queryRunner.query(`
      ALTER TABLE "venues"
        ADD COLUMN IF NOT EXISTS "ward_canonical" varchar(120),
        ADD COLUMN IF NOT EXISTS "ward_type" varchar(16),
        ADD COLUMN IF NOT EXISTS "ward_resolution_method" varchar(16)
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_venues_ward_canonical" ON "venues" ("ward_canonical")`,
    );
    // Composite for the most common search filter: city + ward.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_venues_city_ward" ON "venues" ("city_id", "ward_canonical")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_venues_city_ward"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_venues_ward_canonical"`,
    );
    await queryRunner.query(`
      ALTER TABLE "venues"
        DROP COLUMN IF EXISTS "ward_resolution_method",
        DROP COLUMN IF EXISTS "ward_type",
        DROP COLUMN IF EXISTS "ward_canonical"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "wards"`);
  }
}
