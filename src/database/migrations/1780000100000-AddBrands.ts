import { MigrationInterface, QueryRunner } from 'typeorm';

// Brands become standalone catalog objects (NOT user accounts). Adds the
// `brands` table and `tours.brand_id`, then backfills one brand per distinct
// provider name already denormalised on existing tours and links them.
export class AddBrands1780000100000 implements MigrationInterface {
  name = 'AddBrands1780000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "brands" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(120) NOT NULL,
        "short_name" varchar(16) NOT NULL,
        "logo_url" varchar(500),
        "description" text NOT NULL DEFAULT '',
        "website_url" varchar(500),
        "contact_email" varchar(200),
        "verified" boolean NOT NULL DEFAULT false,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_brands" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_brands_name" ON "brands" ("name")`,
    );

    await queryRunner.query(
      `ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "brand_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tours_brand" ON "tours" ("brand_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "tours" ADD CONSTRAINT "FK_tours_brand" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL`,
    );

    // Backfill: one brand per distinct provider name already on tours.
    await queryRunner.query(`
      INSERT INTO "brands" ("name", "short_name", "logo_url", "verified")
      SELECT DISTINCT ON (t.provider->>'name')
        t.provider->>'name',
        COALESCE(NULLIF(t.provider->>'shortName', ''), LEFT(UPPER(t.provider->>'name'), 6)),
        NULLIF(t.provider->>'logoUrl', ''),
        COALESCE((t.provider->>'verified')::boolean, false)
      FROM "tours" t
      WHERE t.provider->>'name' IS NOT NULL AND t.provider->>'name' <> ''
    `);
    await queryRunner.query(`
      UPDATE "tours" t SET "brand_id" = b.id
      FROM "brands" b
      WHERE b."name" = t.provider->>'name'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tours" DROP CONSTRAINT IF EXISTS "FK_tours_brand"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tours_brand"`);
    await queryRunner.query(
      `ALTER TABLE "tours" DROP COLUMN IF EXISTS "brand_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "brands"`);
  }
}
