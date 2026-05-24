import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBranding1779700100000 implements MigrationInterface {
  name = 'AddUserBranding1779700100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_name" varchar(120) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_short_name" varchar(16) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_logo_url" varchar(500) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_description" text NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_website_url" varchar(500) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_contact_email" varchar(200) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_email_verified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_email_verified_at" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_verification_token" varchar(96) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_verification_token_expires_at" timestamptz NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_brand_verification_token" ON "users" ("brand_verification_token") WHERE "brand_verification_token" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_brand_verification_token"`,
    );
    for (const col of [
      'brand_verification_token_expires_at',
      'brand_verification_token',
      'brand_email_verified_at',
      'brand_email_verified',
      'brand_contact_email',
      'brand_website_url',
      'brand_description',
      'brand_logo_url',
      'brand_short_name',
      'brand_name',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "users" DROP COLUMN IF EXISTS "${col}"`,
      );
    }
  }
}
