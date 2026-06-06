import { MigrationInterface, QueryRunner } from 'typeorm';

// Switch AI search UX from per-venue reasons to a single conversational
// intro paragraph. Adds `intro` text column. Existing `reasons` jsonb
// column kept for now (nullable) — older cached entries still have it,
// new writes leave it null. A later cleanup migration can drop it once
// the 7-day TTL has expired all pre-intro rows.
export class AddAiSearchIntro1780000700000 implements MigrationInterface {
  name = 'AddAiSearchIntro1780000700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_search_cache"
        ADD COLUMN IF NOT EXISTS "intro" text
    `);
    // Wipe pre-intro cached rows so users don't see "no intro" results
    // for queries that happened pre-deploy. Cache is best-effort — losing
    // entries just means the next call regenerates.
    await queryRunner.query(`DELETE FROM "ai_search_cache" WHERE "intro" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_search_cache" DROP COLUMN IF EXISTS "intro"
    `);
  }
}
