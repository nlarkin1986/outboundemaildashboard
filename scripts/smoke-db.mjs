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
  ['batch_runs', 'company_key'],
];

const requiredIndexes = [
  'idx_contacts_run_id',
  'idx_users_email',
  'idx_users_account_id',
  'idx_runs_account_id',
  'idx_runs_created_by_user_id',
  'idx_sequence_emails_contact_id',
  'idx_review_events_run_id',
  'idx_push_jobs_run_id',
  'idx_pushed_contacts_run_id',
  'idx_batch_runs_batch_id',
  'idx_batch_runs_batch_company_key',
  'idx_batches_account_id',
  'idx_batches_created_by_user_id',
  'idx_batch_runs_run_id',
  'idx_research_artifacts_run_id',
  'idx_cowork_messages_batch_id',
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

  const indexesResult = await pool.query(
    `select indexname
     from pg_catalog.pg_indexes
     where schemaname = 'public'
       and indexname = any($1::text[])`,
    [requiredIndexes],
  );
  const foundIndexes = new Set(indexesResult.rows.map((row) => row.indexname));
  const missingIndexes = requiredIndexes.filter((index) => !foundIndexes.has(index));

  if (missingTables.length || missingColumns.length || missingIndexes.length) {
    console.error(JSON.stringify({ ok: false, missing_tables: missingTables, missing_columns: missingColumns, missing_indexes: missingIndexes }));
    process.exit(1);
  }

  const result = await pool.query('select count(*)::int as runs from runs');
  console.log(JSON.stringify({ ok: true, runs: result.rows[0].runs, required_tables: requiredTables.length, required_indexes: requiredIndexes.length }));
} finally {
  await pool.end();
}
