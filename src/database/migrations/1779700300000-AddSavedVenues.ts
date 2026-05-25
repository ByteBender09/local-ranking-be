import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavedVenues1779700300000 implements MigrationInterface {
  name = 'AddSavedVenues1779700300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Older clusters may have come up via `synchronize: true` which auto-installs
    // uuid-ossp; new infra running migrations only might not. Idempotent.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saved_venues" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "venue_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "added_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_venues" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "saved_venues" ADD CONSTRAINT "uq_saved_user_venue" UNIQUE ("user_id", "venue_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_saved_user_added" ON "saved_venues" ("user_id", "added_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_venues" ADD CONSTRAINT "FK_saved_venue_venue" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_venues" ADD CONSTRAINT "FK_saved_venue_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_venues"`);
  }
}
