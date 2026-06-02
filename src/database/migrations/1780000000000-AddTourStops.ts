import { MigrationInterface, QueryRunner } from 'typeorm';

// Introduces the ordered tour_stops itinerary model and the derived
// tours.scope column. Backfills stops from the legacy single-city +
// venue_ids[] shape so existing tours keep rendering. cityId/venue_ids stay on
// `tours` as derived columns (populated by TourManagementService on save).
export class AddTourStops1780000000000 implements MigrationInterface {
  name = 'AddTourStops1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // 1. scope column on tours (intra_city | inter_province).
    await queryRunner.query(
      `ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "scope" varchar(16) NOT NULL DEFAULT 'intra_city'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tours_scope" ON "tours" ("scope")`,
    );

    // 2. tour_stops table.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tour_stops" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tour_id" uuid NOT NULL,
        "order" smallint NOT NULL,
        "city_id" uuid NOT NULL,
        "venue_id" uuid,
        CONSTRAINT "PK_tour_stops" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tour_stops_tour_order" ON "tour_stops" ("tour_id", "order")`,
    );
    await queryRunner.query(
      `ALTER TABLE "tour_stops" ADD CONSTRAINT "FK_tour_stops_tour" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tour_stops" ADD CONSTRAINT "FK_tour_stops_city" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tour_stops" ADD CONSTRAINT "FK_tour_stops_venue" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL`,
    );

    // 3. Backfill: one stop per venue in the tour's city, ordered by the
    //    venue_ids array position. Tours with no venues get a single
    //    city-only stop so the itinerary is never empty.
    await queryRunner.query(`
      INSERT INTO "tour_stops" ("tour_id", "order", "city_id", "venue_id")
      SELECT t.id,
             (v.ord - 1)::smallint AS "order",
             t.city_id,
             v.venue_id
      FROM "tours" t
      JOIN LATERAL unnest(t.venue_ids) WITH ORDINALITY AS v(venue_id, ord) ON true
    `);
    await queryRunner.query(`
      INSERT INTO "tour_stops" ("tour_id", "order", "city_id", "venue_id")
      SELECT t.id, 0::smallint, t.city_id, NULL
      FROM "tours" t
      WHERE COALESCE(array_length(t.venue_ids, 1), 0) = 0
    `);

    // All legacy tours are single-city → intra_city (already the default).
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tour_stops"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tours_scope"`);
    await queryRunner.query(
      `ALTER TABLE "tours" DROP COLUMN IF EXISTS "scope"`,
    );
  }
}
