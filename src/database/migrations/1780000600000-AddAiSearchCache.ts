import { MigrationInterface, QueryRunner } from 'typeorm';

// Cache table for AI-search results. See ai-search-cache.entity.ts for the
// shape rationale. TTL is enforced at read time, not by a scheduled job —
// expired rows linger until overwritten by a fresh hit on the same hash
// (queries cluster on a Pareto curve, so the working set stays tiny).
export class AddAiSearchCache1780000600000 implements MigrationInterface {
  name = 'AddAiSearchCache1780000600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_search_cache" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "query_hash" varchar(64) NOT NULL,
        "query" varchar(500) NOT NULL,
        "intent" jsonb NOT NULL,
        "venue_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "reasons" jsonb,
        "used_reranker" boolean NOT NULL DEFAULT false,
        "hit_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "last_accessed_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_ai_search_cache_query_hash" ON "ai_search_cache" ("query_hash")`,
    );
    // Used by the "popular queries" admin view + future cache-warming.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_search_cache_hit_count" ON "ai_search_cache" ("hit_count" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_search_cache"`);
  }
}
