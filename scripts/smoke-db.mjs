import pg from 'pg';
import { loadLocalEnv } from './load-local-env.mjs';
import { databaseConnectionStringFromEnv } from './db-url.mjs';

loadLocalEnv();
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const requiredTables = [
  'accounts',
  'users',
  'runs',
  'contacts',
  'sequence_emails',
  'review_events',
  'push_jobs',
  'pushed_contacts',
  'batches',
  'batch_runs',
  'research_artifacts',
  'cowork_messages',
];

const requiredColumns = [
  ['runs', 'account_id'],
  ['runs', 'created_by_user_id'],
  ['batches', 'account_id'],
  ['batches', 'created_by_user_id'],
];

const pool = new Pool({
  connectionString: databaseConnectionStringFromEnv(),
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

try {
  const tablesResult = await pool.query(
    `select tablename
     from pg_catalog.pg_tables
     where schemaname = 'public'
       and tablename = any($1::text[])
     order by tablename`,
    [requiredTables],
  );
  const foundTables = new Set(tablesResult.rows.map((row) => row.tablename));
  const missingTables = requiredTables.filter((table) => !foundTables.has(table));

  const columnsResult = await pool.query(
    `select table_name, column_name
     from information_schema.columns
     where table_schema = 'public'
       and (table_name, column_name) in (
         select * from unnest($1::text[], $2::text[])
       )`,
    [requiredColumns.map(([table]) => table), requiredColumns.map(([, column]) => column)],
  );
  const foundColumns = new Set(columnsResult.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missingColumns = requiredColumns
    .map(([table, column]) => `${table}.${column}`)
    .filter((columnKey) => !foundColumns.has(columnKey));

  if (missingTables.length || missingColumns.length) {
    console.error(JSON.stringify({ ok: false, missing_tables: missingTables, missing_columns: missingColumns }));
    process.exit(1);
  }

  const result = await pool.query('select count(*)::int as runs from runs');
  console.log(JSON.stringify({ ok: true, runs: result.rows[0].runs, required_tables: requiredTables.length }));
} finally {
  await pool.end();
}
