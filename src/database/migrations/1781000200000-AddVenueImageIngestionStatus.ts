import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVenueImageIngestionStatus1781000200000
  implements MigrationInterface
{
  name = 'AddVenueImageIngestionStatus1781000200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "image_ingestion_status" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "venues" DROP COLUMN IF EXISTS "image_ingestion_status"`,
    );
  }
}
