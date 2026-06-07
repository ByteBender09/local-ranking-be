// One-shot diagnostic: pulls the latest check-ins to inspect the
// `created_at` timestamp. Run with `node scripts/check-latest-checkin.js`.
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Server-side clock + session timezone — handy when debugging "why does my
  // check-in show 7 hours ago".
  const meta = await client.query(`
    SELECT current_setting('TimeZone') AS session_tz,
           now() AS now_utc,
           now() AT TIME ZONE 'Asia/Ho_Chi_Minh' AS now_vn;
  `);
  console.log('--- server clock ---');
  console.log(meta.rows[0]);

  const rows = await client.query(`
    SELECT
      ci.id,
      ci.user_id,
      u.handle,
      ci.venue_id,
      v.name AS venue_name,
      ci.created_at,
      ci.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS created_vn,
      ci.memory_created_at,
      EXTRACT(EPOCH FROM (now() - ci.created_at))::int AS age_seconds
    FROM check_ins ci
    LEFT JOIN users u ON u.id = ci.user_id
    LEFT JOIN venues v ON v.id = ci.venue_id
    WHERE ci.deleted_at IS NULL
    ORDER BY ci.created_at DESC
    LIMIT 5;
  `);
  console.log('\n--- last 5 check-ins (newest first) ---');
  for (const r of rows.rows) {
    console.log({
      id: r.id,
      user: r.handle,
      venue: r.venue_name,
      createdRaw: r.created_at,
      createdVN: r.created_vn,
      memoryCreatedAt: r.memory_created_at,
      ageSeconds: r.age_seconds,
    });
  }

  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
