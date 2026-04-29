import pg from 'pg';
import { loadLocalEnv } from './load-local-env.mjs';
import { databaseConnectionStringFromEnv } from './db-url.mjs';

loadLocalEnv();
const { Pool } = pg;
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}
const pool = new Pool({ connectionString: databaseConnectionStringFromEnv(), ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } });
try {
  const result = await pool.query('select count(*)::int as runs from runs');
  console.log(JSON.stringify({ ok: true, runs: result.rows[0].runs }));
} finally {
  await pool.end();
}
