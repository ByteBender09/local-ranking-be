import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds a nullable deleted_at column to every entity that owns uploaded
// image files (check_ins, venues, brands, tours), pairing with the new
// @DeleteDateColumn decorators on the entities. TypeORM's softDelete()/
// softRemove() sets this column; find() and findOne() then exclude rows
// where it is non-null automatically — so existing reads keep working
// after a row is "removed". Hard deletes are no longer used for these
// tables, which lets us keep the on-disk image files in case the row is
// later restored (only images explicitly dropped via an update unlink
// their files now — see UploadCleanupService).
//
// Each column also gets a partial index on rows where deleted_at IS NULL
// so the typical "live rows only" query stays fast; the index is small
// because soft-deleted rows are excluded.
export class AddSoftDeleteToImageEntities1781000000000 implements MigrationInterface {
  name = 'AddSoftDeleteToImageEntities1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = ['check_ins', 'venues', 'brands', 'tours'];
    for (const t of tables) {
      await queryRunner.query(
        `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "idx_${t}_live" ON "${t}" ("id") WHERE "deleted_at" IS NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = ['check_ins', 'venues', 'brands', 'tours'];
    for (const t of tables) {
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_${t}_live"`);
      await queryRunner.query(
        `ALTER TABLE "${t}" DROP COLUMN IF EXISTS "deleted_at"`,
      );
    }
  }
}
