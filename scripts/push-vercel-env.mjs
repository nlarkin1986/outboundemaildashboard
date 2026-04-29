#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const envFile = resolve(process.argv[2] ?? '.env.local');
const targets = (process.argv[3] ?? 'production,preview,development')
  .split(',')
  .map((target) => target.trim())
  .filter(Boolean);

const allowedTargets = new Set(['production', 'preview', 'development']);
for (const target of targets) {
  if (!allowedTargets.has(target)) {
    console.error(`Invalid Vercel environment target: ${target}`);
    process.exit(1);
  }
}

const required = [
  'DATABASE_URL',
  'DATABASE_SSL',
  'APP_BASE_URL',
  'INTERNAL_API_SECRET',
  'ANTHROPIC_API_KEY',
  'EXA_API_KEY',
  'BROWSERBASE_API_KEY',
  'BROWSERBASE_PROJECT_ID',
  'INSTANTLY_API_KEY',
  'COWORK_WEBHOOK_SECRET',
  'REVIEW_SIGNING_SECRET',
];

const optional = [
  'DATABASE_POOL_MAX',
  'INSTANTLY_WORKSPACE_ID',
  'COWORK_API_KEY',
  'MCP_API_SECRET',
  'MCP_AUTH_DISABLED',
];

function parseDotenv(text) {
  const out = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2] ?? '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out.set(match[1], value);
  }
  return out;
}

if (!existsSync(envFile)) {
  console.error(`Missing ${envFile}. Create it from .env.example with real values first.`);
  process.exit(1);
}

const env = parseDotenv(readFileSync(envFile, 'utf8'));
const missing = required.filter((name) => !env.get(name) || env.get(name)?.includes('[REDACTED]') || env.get(name)?.includes('placeholder'));
if (missing.length) {
  console.error(`Refusing to push incomplete env. Missing or placeholder values: ${missing.join(', ')}`);
  process.exit(1);
}

const varsToPush = [...required, ...optional.filter((name) => Boolean(env.get(name)))];

console.log(`Pushing ${varsToPush.length} env vars from ${envFile} to Vercel targets: ${targets.join(', ')}`);
console.log('Values will not be printed. Existing values will be overwritten with --force.');

for (const target of targets) {
  for (const name of varsToPush) {
    const value = env.get(name);
    const result = spawnSync('vercel', ['env', 'add', name, target, '--force', '--yes'], {
      input: value,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });

    if (result.status !== 0) {
      console.error(`Failed to add ${name} to ${target}.`);
      const stderr = result.stderr.replaceAll(value, '[REDACTED]');
      const stdout = result.stdout.replaceAll(value, '[REDACTED]');
      if (stdout.trim()) console.error(stdout.trim());
      if (stderr.trim()) console.error(stderr.trim());
      process.exit(result.status ?? 1);
    }
    console.log(`✓ ${name} -> ${target}`);
  }
}

console.log('Done. Run `vercel env ls` to verify names/targets, then `npm run db:setup` with local DATABASE_URL and `vercel --prod`.');
