import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');

function read(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('readiness configuration', () => {
  it('keeps database schema and smoke checks aligned for batch idempotency', () => {
    const schema = read('docs/schema.sql');
    const smoke = read('scripts/smoke-db.mjs');

    expect(schema).toMatch(/company_key text/);
    expect(schema).toMatch(/idx_batch_runs_batch_company_key/);
    expect(smoke).toMatch(/batch_runs', 'company_key/);
    expect(smoke).toMatch(/idx_batch_runs_batch_company_key/);
    expect(smoke).toMatch(/missing_indexes/);
  });

  it('documents the runtime env vars that the Vercel push script manages', () => {
    const example = read('.env.example');
    const pushScript = read('scripts/push-vercel-env.mjs');
    const readme = read('README.md');

    for (const name of ['DATABASE_URL', 'DATABASE_SSL', 'APP_BASE_URL', 'INTERNAL_API_SECRET', 'ANTHROPIC_API_KEY', 'EXA_API_KEY', 'BROWSERBASE_API_KEY', 'BROWSERBASE_PROJECT_ID', 'INSTANTLY_API_KEY', 'COWORK_API_BASE_URL', 'COWORK_API_KEY', 'COWORK_WEBHOOK_SECRET', 'MCP_API_SECRET']) {
      expect(example).toContain(name);
      expect(readme).toContain(name);
    }

    expect(pushScript).toContain('MCP_API_SECRET');
    expect(pushScript).toContain('COWORK_API_KEY');
  });

  it('keeps BDR play docs aligned with the MCP schema field', () => {
    const mcpSchema = read('lib/mcp/schemas.ts');
    const readme = read('README.md');
    const bdrDocs = read('docs/bdr-play-intake.md');
    const pollingDocs = read('docs/cowork-async-polling-instructions.md');

    for (const text of [mcpSchema, readme, bdrDocs, pollingDocs]) {
      expect(text).toContain('bdr_cold_outbound');
    }
    expect(bdrDocs).toContain('no more than two follow-up turns');
  });

  it('documents and scripts live MCP schema verification for BDR routing', () => {
    const packageJson = read('package.json');
    const verifier = read('scripts/verify-mcp-schema.mjs');
    const bdrSmoke = read('scripts/verify-bdr-processing-smoke.mjs');
    const readme = read('README.md');
    const pollingDocs = read('docs/cowork-async-polling-instructions.md');

    expect(packageJson).toContain('mcp:schema:verify');
    expect(packageJson).toContain('mcp:bdr-smoke');
    expect(verifier).toContain('/api/mcp');
    expect(verifier).toContain('tools/list');
    expect(verifier).toContain('play_id');
    expect(verifier).toContain('play_metadata');
    expect(verifier).toContain('bdr_cold_outbound');
    expect(verifier).toContain('/api/health');
    expect(verifier).toContain('contract_revision');
    expect(read('scripts/package-account-sequencer-skill.mjs')).toContain('bdr-vercel-pipeline-2026-05-01');
    expect(bdrSmoke).toContain('BDR_SMOKE_ACTOR_EMAIL');
    expect(bdrSmoke).toContain("BDR_SMOKE_COMPANY_NAME ?? 'Gruns'");
    expect(bdrSmoke).toContain("BDR_SMOKE_CONTACT_NAME ?? 'Jillian'");
    expect(bdrSmoke).toContain('smoke_correlation_id');
    expect(bdrSmoke).toContain('processing_route');
    expect(bdrSmoke).toContain('bdr_workflow');
    expect(bdrSmoke).toContain('contract_revision');
    expect(bdrSmoke).toContain('handoffs without the reset');
    expect(readme).toContain('npm run mcp:schema:verify');
    expect(readme).toContain('npm run mcp:bdr-smoke');
    expect(readme).toContain('play_id');
    expect(readme).toContain('play_metadata');
    expect(readme).toContain('BDR_SMOKE_REQUIRE_VERCEL');
    expect(readme).toContain('BDR_SMOKE_REQUIRE_DATABASE');
    expect(readme).toContain('BDR_SMOKE_COMPANY_NAME');
    expect(readme).toContain('Gruns');
    expect(readme).toContain('Jillian');
    expect(readme).toContain('diagnostics.processing_route');
    expect(readme).toContain('contract_revision');
    expect(readme).toContain('Stale BDR batch triage');
    expect(readme).toContain('Suspect BDR fallback');
    expect(readme).toContain('EXA_API_KEY');
    expect(pollingDocs).toContain('diagnostics.processing_route');
    expect(pollingDocs).toContain('diagnostics.deployment.contract_revision');
    expect(pollingDocs).toContain('generic_company_agent');
  });

  it('fails database smoke checks before connecting when DATABASE_URL is missing or malformed', () => {
    const script = resolve(root, 'scripts/smoke-db.mjs');
    const cwd = mkdtempSync(join(tmpdir(), 'outbound-smoke-'));

    const missing = spawnSync(process.execPath, [script], {
      cwd,
      env: { ...process.env, DATABASE_URL: '' },
      encoding: 'utf8',
    });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/DATABASE_URL is required/);

    const malformed = spawnSync(process.execPath, [script], {
      cwd,
      env: { ...process.env, DATABASE_URL: 'https://example.com/db' },
      encoding: 'utf8',
    });
    expect(malformed.status).not.toBe(0);
    expect(malformed.stderr).toMatch(/postgres:\/\/ or postgresql:\/\//);
  });
});
