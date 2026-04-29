import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadLocalEnv } from './load-local-env.mjs';
import { databaseConnectionStringFromEnv } from './db-url.mjs';

loadLocalEnv();
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const schemaPath = path.join(process.cwd(), 'docs', 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');
const pool = new Pool({
  connectionString: databaseConnectionStringFromEnv(),
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

try {
  await pool.query(sql);
  console.log('Database schema applied successfully.');
} finally {
  await pool.end();
}
