// Pull the latest check-in and check ALL angles: raw string vs JS Date vs
// epoch math, server clock, and local clock — figure out where the +7h drift
// is being introduced.
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const r = await client.query(`
    WITH latest AS (
      SELECT id, created_at, memory_created_at
      FROM check_ins
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    )
    SELECT
      latest.id,
      latest.created_at,
      latest.memory_created_at,
      latest.created_at::text         AS created_at_str,
      latest.memory_created_at::text  AS memory_created_at_str,
      EXTRACT(EPOCH FROM latest.created_at) AS created_at_epoch,
      EXTRACT(EPOCH FROM latest.memory_created_at) AS memory_created_at_epoch,
      now()                            AS pg_now,
      EXTRACT(EPOCH FROM now())        AS pg_now_epoch,
      EXTRACT(EPOCH FROM (now() - latest.created_at))::int AS age_seconds
    FROM latest;
  `);

  const row = r.rows[0];
  console.log('--- raw postgres strings (no JS coercion) ---');
  console.log({
    created_at_str: row.created_at_str,
    memory_created_at_str: row.memory_created_at_str,
    pg_now_text: row.pg_now,
  });
  console.log('\n--- epoch seconds (compare with Date.now()/1000) ---');
  console.log({
    created_at_epoch: row.created_at_epoch,
    memory_created_at_epoch: row.memory_created_at_epoch,
    pg_now_epoch: row.pg_now_epoch,
    js_now_epoch: Math.floor(Date.now() / 1000),
    age_seconds: row.age_seconds,
  });
  console.log('\n--- JS Date hydration via pg ---');
  console.log({
    created_at_iso: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at,
    memory_created_at_iso: row.memory_created_at instanceof Date
      ? row.memory_created_at.toISOString()
      : row.memory_created_at,
  });

  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
