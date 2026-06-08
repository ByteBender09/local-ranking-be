// Simulate exactly what TypeORM serializes for `created_at` on the latest
// check-in. The answer here tells us what the mobile parses on its side.
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const r = await client.query(`
    SELECT id, created_at, memory_created_at, updated_at
    FROM check_ins
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;
  `);
  const row = r.rows[0];
  console.log('--- raw row from pg (hydrated by node-postgres) ---');
  console.log({
    id: row.id,
    created_at_typeof: typeof row.created_at,
    created_at_isDate: row.created_at instanceof Date,
    created_at_toISOString: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at,
    created_at_inspect: row.created_at?.toString?.(),
    memory_created_at_toISOString: row.memory_created_at?.toISOString?.(),
    updated_at_toISOString: row.updated_at?.toISOString?.(),
  });
  console.log('\n--- JSON.stringify (what TypeORM/Nest sends over the wire) ---');
  console.log(JSON.stringify(row, null, 2));
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
