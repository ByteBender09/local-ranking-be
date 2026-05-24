import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1779603626117 implements MigrationInterface {
    name = 'InitialSchema1779603626117'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "venues" ADD "is_published" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "check_ins" ALTER COLUMN "photos" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`ALTER TABLE "check_ins" ALTER COLUMN "friends" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "socials" SET DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "venues" ALTER COLUMN "images" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`ALTER TABLE "venues" ALTER COLUMN "tags" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`ALTER TABLE "tours" ALTER COLUMN "highlights" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`ALTER TABLE "tours" ALTER COLUMN "venue_ids" SET DEFAULT ARRAY[]::uuid[]`);
        await queryRunner.query(`ALTER TABLE "tours" ALTER COLUMN "promotions" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "cities" ALTER COLUMN "highlights" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`CREATE INDEX "IDX_d61494f7745f5076ee03b26764" ON "venues" ("is_published") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_d61494f7745f5076ee03b26764"`);
        await queryRunner.query(`ALTER TABLE "cities" ALTER COLUMN "highlights" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "tours" ALTER COLUMN "promotions" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "tours" ALTER COLUMN "venue_ids" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "tours" ALTER COLUMN "highlights" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "venues" ALTER COLUMN "tags" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "venues" ALTER COLUMN "images" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "socials" SET DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "check_ins" ALTER COLUMN "friends" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "check_ins" ALTER COLUMN "photos" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "venues" DROP COLUMN "is_published"`);
    }

}
