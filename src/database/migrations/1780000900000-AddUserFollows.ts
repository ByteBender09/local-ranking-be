import { MigrationInterface, QueryRunner } from 'typeorm';

// One follow edge per (follower, following) pair. The convention:
// follower_id is the user who initiated the follow; following_id is the
// target. users.follower_count is the denormalised count of rows where
// following_id = users.id, kept in sync by UsersService inside a tx.
//
// Resets users.follower_count to 0 in the same migration so the denorm
// matches the empty user_follows table; pre-2026 seed values for that
// column were placeholder noise (random) and no longer source-of-truth.
export class AddUserFollows1780000900000 implements MigrationInterface {
  name = 'AddUserFollows1780000900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "follower_id" uuid NOT NULL,
        "following_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_user_follows" PRIMARY KEY ("id"),
        CONSTRAINT "uq_user_follow_pair" UNIQUE ("follower_id", "following_id"),
        CONSTRAINT "fk_user_follow_follower" FOREIGN KEY ("follower_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_user_follow_following" FOREIGN KEY ("following_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "chk_user_follow_self" CHECK ("follower_id" <> "following_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_follow_following_created"
        ON "user_follows" ("following_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_follow_follower_created"
        ON "user_follows" ("follower_id", "created_at" DESC)
    `);
    await queryRunner.query(`UPDATE "users" SET "follower_count" = 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_follows"`);
  }
}
