// Reverse the FixCheckInTimestampsTZ1781000500000 migration manually
// because the migration file was deleted before TypeORM could run its
// generated `down()`. Restores `check_ins.created_at` and `updated_at` back
// to `timestamp without time zone`, treating the stored value as UTC (which
// is what we stored when promoting them).
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE "check_ins"
        ALTER COLUMN "created_at" TYPE TIMESTAMP WITHOUT TIME ZONE
        USING ("created_at" AT TIME ZONE 'UTC');
    `);
    await client.query(`
      ALTER TABLE "check_ins"
        ALTER COLUMN "updated_at" TYPE TIMESTAMP WITHOUT TIME ZONE
        USING ("updated_at" AT TIME ZONE 'UTC');
    `);
    const del = await client.query(
      `DELETE FROM "migrations" WHERE name = $1`,
      ['FixCheckInTimestampsTZ1781000500000'],
    );
    console.log('removed migrations row count:', del.rowCount);
    await client.query('COMMIT');
    console.log('done. check_ins.created_at / updated_at reverted to timestamp.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
