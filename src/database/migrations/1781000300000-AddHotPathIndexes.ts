import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotPathIndexes1781000300000 implements MigrationInterface {
  name = 'AddHotPathIndexes1781000300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_votes_upvotes_recent" ON "votes" ("created_at", "venue_id") WHERE "value" = 1`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_saved_venues_added_at" ON "saved_venues" ("added_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_users_check_in_count" ON "users" ("check_in_count" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_check_ins_user_created" ON "check_ins" ("user_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_check_ins_public_recent" ON "check_ins" ("created_at" DESC) WHERE "is_public" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_votes_upvotes_recent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_saved_venues_added_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_check_in_count"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_check_ins_user_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_check_ins_public_recent"`,
    );
  }
}
