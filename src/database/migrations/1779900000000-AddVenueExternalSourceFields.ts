import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds provenance + externally-sourced rating/hours columns to `venues`.
// Source-neutral (Foursquare today; Google was blocked for Vietnam) — column
// names are `external_*` rather than tied to one provider.
//
// Rating strategy (blend, không wipe):
//   • external_rating / external_review_count = số liệu gốc từ nguồn ngoài
//     (Foursquare), đã chuẩn hoá về thang 0–5. KHÔNG bị ReviewsService ghi đè.
//   • rating / review_count (cột cũ) = giá trị HIỂN THỊ đã blend (external +
//     review nội bộ); importer seed sẵn = giá trị external.
//   • external_opening_hours (jsonb) = giờ mở cửa đầy đủ; `hours` (varchar 64)
//     giữ chuỗi rút gọn cho UI hiện tại.
//   • source = 'curated' | 'foursquare'.
export class AddVenueExternalSourceFields1779900000000
  implements MigrationInterface
{
  name = 'AddVenueExternalSourceFields1779900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop any leftover columns from the abandoned Google attempt (if a dev DB
    // auto-synced them) so naming stays clean.
    await queryRunner.query(`
      ALTER TABLE "venues"
        DROP COLUMN IF EXISTS "google_place_id",
        DROP COLUMN IF EXISTS "google_rating",
        DROP COLUMN IF EXISTS "google_review_count",
        DROP COLUMN IF EXISTS "google_opening_hours",
        DROP COLUMN IF EXISTS "google_synced_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "venues"
        ADD COLUMN IF NOT EXISTS "source" varchar(16) NOT NULL DEFAULT 'curated',
        ADD COLUMN IF NOT EXISTS "external_id" varchar(300),
        ADD COLUMN IF NOT EXISTS "external_rating" numeric(3,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "external_review_count" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "external_opening_hours" jsonb,
        ADD COLUMN IF NOT EXISTS "external_synced_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "external_raw" jsonb
    `);
    // Dedupe guard: one external place maps to at most one venue. Partial
    // unique so the many NULLs (curated venues) don't collide.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_venues_external_id"
        ON "venues" ("external_id")
        WHERE "external_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_venues_source" ON "venues" ("source")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_venues_source"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_venues_external_id"`);
    await queryRunner.query(`
      ALTER TABLE "venues"
        DROP COLUMN IF EXISTS "external_raw",
        DROP COLUMN IF EXISTS "external_synced_at",
        DROP COLUMN IF EXISTS "external_opening_hours",
        DROP COLUMN IF EXISTS "external_review_count",
        DROP COLUMN IF EXISTS "external_rating",
        DROP COLUMN IF EXISTS "external_id",
        DROP COLUMN IF EXISTS "source"
    `);
  }
}
