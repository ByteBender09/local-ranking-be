import { MigrationInterface, QueryRunner } from 'typeorm';

// Lets a trip owner end a journey early. Once `ended_at` is set the trip becomes
// read-only (no new memories collected) and the app flips to the ended-album
// view. Auto-end after `end_date` is derived client-side, so this column stays
// null in that case.
export class AddTripEndedAt1784000000000 implements MigrationInterface {
  name = 'AddTripEndedAt1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "ended_at" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trips" DROP COLUMN IF EXISTS "ended_at"`,
    );
  }
}
