import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds users.following_count and backfills it from user_follows. The
// counter is then kept in sync inside UsersService.follow()/unfollow()
// in the same transaction as follower_count.
export class AddUserFollowingCount1781000100000 implements MigrationInterface {
  name = 'AddUserFollowingCount1781000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "following_count" int NOT NULL DEFAULT 0`,
    );
    // Backfill from the source of truth so the counter matches today's
    // graph the moment the column exists.
    await queryRunner.query(`
      UPDATE "users" u
         SET "following_count" = COALESCE(c.cnt, 0)
        FROM (
          SELECT "follower_id" AS uid, COUNT(*)::int AS cnt
            FROM "user_follows"
           GROUP BY "follower_id"
        ) c
       WHERE u."id" = c.uid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "following_count"`,
    );
  }
}
