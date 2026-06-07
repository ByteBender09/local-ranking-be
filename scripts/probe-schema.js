// Show the actual Postgres column types for the check_ins table — to verify
// whether `created_at` is `timestamp` or `timestamptz`.
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const r = await client.query(`
    SELECT column_name, data_type, udt_name, datetime_precision
    FROM information_schema.columns
    WHERE table_name = 'check_ins'
      AND column_name IN ('created_at', 'memory_created_at', 'updated_at', 'deleted_at')
    ORDER BY column_name;
  `);
  for (const row of r.rows) console.log(row);
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
