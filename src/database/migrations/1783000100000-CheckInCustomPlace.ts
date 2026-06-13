import { MigrationInterface, QueryRunner } from 'typeorm';

// Allow check-ins at custom places not in the venues catalog (used by the trip
// feature). venue_id becomes nullable; when null, the row carries its own
// place_name + lat/lng (and optional address) instead of a venue FK.
export class CheckInCustomPlace1783000100000 implements MigrationInterface {
  name = 'CheckInCustomPlace1783000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "check_ins" ALTER COLUMN "venue_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "place_name" varchar(160)`,
    );
    await queryRunner.query(
      `ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "place_address" varchar(240)`,
    );
    await queryRunner.query(
      `ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "lat" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "lng" double precision`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "check_ins" DROP COLUMN IF EXISTS "lng"`,
    );
    await queryRunner.query(
      `ALTER TABLE "check_ins" DROP COLUMN IF EXISTS "lat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "check_ins" DROP COLUMN IF EXISTS "place_address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "check_ins" DROP COLUMN IF EXISTS "place_name"`,
    );
    // NOTE: not re-adding NOT NULL on venue_id in down() — custom check-ins may
    // exist by then and would violate it. Restore manually if truly reverting.
  }
}
