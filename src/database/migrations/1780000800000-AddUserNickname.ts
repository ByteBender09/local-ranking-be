import { MigrationInterface, QueryRunner } from 'typeorm';

// User-chosen display name that overrides the OAuth `name` field on
// public surfaces (leaderboard, venue cards, etc.). Empty by default —
// the FE renders nickname || name so existing users keep their legal
// name until they explicitly set a nickname.
export class AddUserNickname1780000800000 implements MigrationInterface {
  name = 'AddUserNickname1780000800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "nickname" varchar(40) NOT NULL DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "nickname"`);
  }
}
