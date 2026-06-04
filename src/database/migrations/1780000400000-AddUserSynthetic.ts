import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds `is_synthetic` to `users`. These are placeholder reviewer accounts the
// importer creates to attach scraped Google reviews (handle `g-…`, no real
// login). The flag lets the web detail page render their reviews in the
// "Google reviews" section (photo + name only, no @handle) instead of treating
// them like real in-app reviews. Backfills the existing `g-…` accounts.
export class AddUserSynthetic1780000400000 implements MigrationInterface {
  name = 'AddUserSynthetic1780000400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "is_synthetic" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      UPDATE "users" SET "is_synthetic" = true
      WHERE "handle" LIKE 'g-%'
        AND "google_id" IS NULL
        AND "email" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "is_synthetic"`,
    );
  }
}
