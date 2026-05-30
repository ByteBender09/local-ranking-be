import { MigrationInterface, QueryRunner } from 'typeorm';

// Allow a venue to be checked in multiple times (one per day, enforced in the
// service) and add a memory creation timestamp that drives the 30-minute
// edit/delete lock.
export class MultiCheckInAndMemoryLock1779800000000
  implements MigrationInterface
{
  name = 'MultiCheckInAndMemoryLock1779800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the one-check-in-per-(user,venue) unique constraint.
    await queryRunner.query(
      `ALTER TABLE "check_ins" DROP CONSTRAINT IF EXISTS "uq_checkin_user_venue"`,
    );

    // Memory creation timestamp (null until a memory is written).
    await queryRunner.query(
      `ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "memory_created_at" timestamptz NULL`,
    );

    // Backfill: existing check-ins that already carry a memory are treated as
    // created at check-in time, which immediately locks them (their created_at
    // is well past the 30-minute window).
    await queryRunner.query(
      `UPDATE "check_ins"
         SET "memory_created_at" = "created_at"
       WHERE "memory_created_at" IS NULL
         AND (("comment" IS NOT NULL AND length(trim("comment")) > 0)
              OR coalesce(array_length("photos", 1), 0) > 0)`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_checkins_user_venue_created" ON "check_ins" ("user_id", "venue_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_checkins_user_venue_created"`,
    );
    await queryRunner.query(
      `ALTER TABLE "check_ins" DROP COLUMN IF EXISTS "memory_created_at"`,
    );
    // Re-adding the unique constraint can fail if duplicate (user, venue) rows
    // now exist; that's expected once multi-check-in data is present.
    await queryRunner.query(
      `ALTER TABLE "check_ins" ADD CONSTRAINT "uq_checkin_user_venue" UNIQUE ("user_id", "venue_id")`,
    );
  }
}
