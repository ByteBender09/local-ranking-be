import { MigrationInterface, QueryRunner } from 'typeorm';

// Trip feature: a shared "journey room". An owner picks dates + destinations
// and invites friends; member memories are derived by querying their public
// check-ins within the trip window (no join column on check_ins).
//   - trips             : the room (owner, title, dates, visibility)
//   - trip_destinations : ordered city stops (first = start, last = end)
//   - trip_members      : membership + invite lifecycle (role/status)
export class AddTripTables1783000000000 implements MigrationInterface {
  name = 'AddTripTables1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // uuid_generate_v4() comes from uuid-ossp. Established infra already has it;
    // ensure it for migration-only setups. Idempotent.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trips" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "owner_id"    uuid NOT NULL,
        "title"       varchar(120) NOT NULL,
        "cover_image" varchar(500),
        "start_date"  timestamptz NOT NULL,
        "end_date"    timestamptz NOT NULL,
        "visibility"  varchar(16) NOT NULL DEFAULT 'followers',
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        "updated_at"  timestamptz NOT NULL DEFAULT now(),
        "deleted_at"  timestamptz,
        CONSTRAINT "pk_trips" PRIMARY KEY ("id"),
        CONSTRAINT "fk_trips_owner" FOREIGN KEY ("owner_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_trips_owner" ON "trips" ("owner_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trip_destinations" (
        "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
        "trip_id"    uuid NOT NULL,
        "city_id"    uuid NOT NULL,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_trip_destinations" PRIMARY KEY ("id"),
        CONSTRAINT "fk_trip_destinations_trip" FOREIGN KEY ("trip_id")
          REFERENCES "trips"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_trip_destinations_city" FOREIGN KEY ("city_id")
          REFERENCES "cities"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_trip_destinations_trip_order" ON "trip_destinations" ("trip_id", "sort_order")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trip_members" (
        "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "trip_id"       uuid NOT NULL,
        "user_id"       uuid NOT NULL,
        "role"          varchar(8) NOT NULL DEFAULT 'member',
        "status"        varchar(8) NOT NULL DEFAULT 'invited',
        "invited_by_id" uuid,
        "joined_at"     timestamptz,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_trip_members" PRIMARY KEY ("id"),
        CONSTRAINT "uq_trip_member_pair" UNIQUE ("trip_id", "user_id"),
        CONSTRAINT "fk_trip_members_trip" FOREIGN KEY ("trip_id")
          REFERENCES "trips"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_trip_members_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_trip_members_user" ON "trip_members" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_trip_members_trip_status" ON "trip_members" ("trip_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "trip_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trip_destinations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trips"`);
  }
}
