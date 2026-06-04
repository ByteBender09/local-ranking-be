import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds a first-class `website` column to `venues` and backfills it from the
// scraped provenance JSON, where the URL used to live in two different shapes:
//   • apify importer:   external_raw -> 'website'            (top level)
//   • pisomap importer: external_raw -> 'contacts' -> 'website'
// A real column makes the website editable from the admin venue editor and
// validatable, instead of being read out of (and the pisomap path NOT read out
// of) the raw payload.
export class AddVenueWebsite1780000300000 implements MigrationInterface {
  name = 'AddVenueWebsite1780000300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "website" varchar(500)
    `);
    // Backfill: prefer the apify top-level website, then the pisomap
    // contacts.website. Only set valid http(s) URLs; leave the rest NULL.
    // LEFT(..., 500) guards against the occasional very long tracking URL that
    // would overflow the column.
    await queryRunner.query(`
      UPDATE "venues"
      SET "website" = LEFT(COALESCE(
        NULLIF("external_raw" ->> 'website', ''),
        NULLIF("external_raw" -> 'contacts' ->> 'website', '')
      ), 500)
      WHERE "website" IS NULL
        AND (
          COALESCE("external_raw" ->> 'website', '') ~* '^https?://'
          OR COALESCE("external_raw" -> 'contacts' ->> 'website', '') ~* '^https?://'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "venues" DROP COLUMN IF EXISTS "website"`,
    );
  }
}
