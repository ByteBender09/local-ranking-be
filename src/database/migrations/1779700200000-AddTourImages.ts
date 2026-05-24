import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTourImages1779700200000 implements MigrationInterface {
  name = 'AddTourImages1779700200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "images" text[] NOT NULL DEFAULT ARRAY[]::text[]`,
    );
    // Make the legacy single-image column tolerate empty values now that the
    // gallery is the canonical source.
    await queryRunner.query(
      `ALTER TABLE "tours" ALTER COLUMN "image" SET DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tours" DROP COLUMN IF EXISTS "images"`,
    );
  }
}
