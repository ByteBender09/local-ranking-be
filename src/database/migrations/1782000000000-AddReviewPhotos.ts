import { MigrationInterface, QueryRunner } from 'typeorm';

// Reviews scraped from Google via PISO sometimes include photos that the
// reviewer attached. Store those photo URLs on the review row so the detail
// page can render the gallery the same way Google Maps does. URLs are kept
// as-is (typically lh3.googleusercontent.com) — already in our next/image
// whitelist, no need to rehost to our CDN.
export class AddReviewPhotos1782000000000 implements MigrationInterface {
  name = 'AddReviewPhotos1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "photos" text[] NOT NULL DEFAULT ARRAY[]::text[]`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP COLUMN IF EXISTS "photos"`,
    );
  }
}
