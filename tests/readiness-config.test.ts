import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');

function read(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

function runNodeScript(script: string, args: string[], env: NodeJS.ProcessEnv, nodeArgs: string[] = []) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolveRun, reject) => {
    const child = spawn(process.execPath, [...nodeArgs, script, ...args], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (status) => resolveRun({ status, stdout, stderr }));
  });
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

    for (const name of ['DATABASE_URL', 'DATABASE_SSL', 'APP_BASE_URL', 'INTERNAL_API_SECRET', 'ANTHROPIC_API_KEY', 'EXA_API_KEY', 'FIRECRAWL_API_KEY', 'INSTANTLY_API_KEY', 'COWORK_API_BASE_URL', 'COWORK_API_KEY', 'COWORK_WEBHOOK_SECRET', 'MCP_API_SECRET']) {
      expect(example).toContain(name);
      expect(readme).toContain(name);
    }

    expect(pushScript).toContain('MCP_API_SECRET');
    expect(pushScript).toContain('COWORK_API_KEY');
    expect(example).toContain('BROWSERBASE_API_KEY');
    expect(readme).toContain('BROWSERBASE_API_KEY');
    expect(pushScript).toContain('BROWSERBASE_API_KEY');
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
    const bdrEval = read('scripts/verify-bdr-live-e2e-eval.mjs');
    const readme = read('README.md');
    const pollingDocs = read('docs/cowork-async-polling-instructions.md');

    expect(packageJson).toContain('mcp:schema:verify');
    expect(packageJson).toContain('mcp:bdr-smoke');
    expect(packageJson).toContain('mcp:bdr-eval');
    expect(verifier).toContain('/api/mcp');
    expect(verifier).toContain('tools/list');
    expect(verifier).toContain('play_id');
    expect(verifier).toContain('play_metadata');
    expect(verifier).toContain('bdr_cold_outbound');
    expect(verifier).toContain('/api/health');
    expect(verifier).toContain('contract_revision');
    expect(read('scripts/package-account-sequencer-skill.mjs')).toContain('bdr-vercel-pipeline-2026-05-01');
    expect(readme).toContain('npm run mcp:schema:verify');
    expect(readme).toContain('npm run mcp:bdr-smoke');
    expect(readme).toContain('npm run mcp:bdr-eval');
    expect(readme).toContain('play_id');
    expect(readme).toContain('play_metadata');
    expect(readme).toContain('BDR_SMOKE_REQUIRE_VERCEL');
    expect(readme).toContain('BDR_SMOKE_REQUIRE_DATABASE');
    expect(readme).toContain('BDR_SMOKE_COMPANY_NAME');
    expect(readme).toContain('Gruns');
    expect(readme).toContain('Jillian');
    expect(readme).toContain('diagnostics.processing_route');
    expect(readme).toContain('contract_revision');
    expect(readme).toContain('prompt_pack_revision');
    expect(readme).toContain('diagnostics.bdr_personalization.optimized_dossier_path');
    expect(readme).toContain('fallback_causes');
    expect(readme).toContain('BDR_EVAL_ACTOR_EMAIL');
    expect(readme).toContain('BDR_EVAL_COMPANIES');
    expect(readme).toContain('BDR_EVAL_RERUN_FROM');
    expect(readme).toContain('tmp/bdr-live-e2e-eval');
    expect(readme).toContain('The Black Tux');
    expect(readme).toContain('Manscapped');
    expect(readme).toContain('Alo Yoga');
    expect(readme).toContain('CX leaders');
    expect(readme).toContain('pass');
    expect(readme).toContain('warn');
    expect(readme).toContain('fail');
    expect(readme).toContain('Stale BDR batch triage');
    expect(readme).toContain('Suspect BDR fallback');
    expect(readme).toContain('EXA_API_KEY');
    expect(readme).toContain('FIRECRAWL_API_KEY');
    expect(bdrEval).toContain('/api/mcp');
    expect(bdrEval).toContain('BDR_EVAL_ACTOR_EMAIL');
    expect(bdrEval).toContain('Gruns');
    expect(bdrEval).toContain('The Black Tux');
    expect(bdrEval).toContain('Quince');
    expect(bdrEval).toContain('Manscapped');
    expect(bdrEval).toContain('Alo Yoga');
    expect(bdrEval).toContain('CX leaders');
    expect(bdrEval).toContain('generic_company_agent');
    expect(bdrEval).toContain('tmp/bdr-live-e2e-eval');
    expect(pollingDocs).toContain('diagnostics.processing_route');
    expect(pollingDocs).toContain('diagnostics.deployment.contract_revision');
    expect(pollingDocs).toContain('generic_company_agent');
    expect(pollingDocs).toContain('npm run mcp:bdr-eval');
  });

  it('runs the BDR processing smoke against MCP and review-state responses', async () => {
    const origin = 'https://smoke.example.test';
    const fetchShim = `
      const origin = ${JSON.stringify(origin)};
      const diagnostics = {
        processing_route: 'bdr_workflow',
        runtime: 'vercel',
        persistence: 'database',
        deployment: {
          contract_revision: 'bdr-test-contract',
          prompt_pack_revision: 'bdr-cold-outbound-inline-prompts-2026-05-02',
        },
        bdr_personalization: {
          optimized_dossier_path: 'enabled',
          fallback_causes: [],
        },
      };
      globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        if (url.pathname === '/api/mcp') {
          const body = JSON.parse(init.body);
          if (body.params?.name !== 'create_outbound_sequence' && body.params?.name !== 'get_outbound_sequence_status') {
            return new Response(JSON.stringify({ error: 'unexpected tool' }), { status: 400, headers: { 'content-type': 'application/json' } });
          }
          const structuredContent = {
            ok: true,
            batch_id: 'batch_smoke',
            status: 'ready_for_review',
            play_id: 'bdr_cold_outbound',
            review_url: origin + '/review/batch/token_smoke',
            dashboard_status_url: origin + '/admin/runs?batch_id=batch_smoke',
            poll_tool: 'get_outbound_sequence_status',
            recommended_poll_after_seconds: 1,
            max_poll_attempts: 1,
            is_terminal: true,
            cowork_next_action: { instruction: 'review' },
            diagnostics,
          };
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              isError: false,
              structuredContent,
              content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
            },
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (url.pathname === '/api/review/batch/token_smoke/state') {
          return new Response(JSON.stringify({
            batch: { id: 'batch_smoke', play_id: 'bdr_cold_outbound' },
            runs: [{
              review: {
                contacts: [{
                  first_name: 'Jillian',
                  play_metadata: { play_id: 'bdr_cold_outbound' },
                  emails: [{ body_text: 'Jillian, Gruns support leaders likely see fit questions before purchase.' }],
                }],
              },
            }],
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
      };
    `;
    const result = await runNodeScript(resolve(root, 'scripts/verify-bdr-processing-smoke.mjs'), [origin], {
      ...process.env,
      BDR_SMOKE_ACTOR_EMAIL: 'smoke@example.com',
      BDR_SMOKE_REQUIRE_VERCEL: 'false',
      BDR_SMOKE_REQUIRE_DATABASE: 'false',
      BDR_SMOKE_MAX_POLLS: '1',
      BDR_SMOKE_POLL_INTERVAL_MS: '1',
    }, ['--import', `data:text/javascript,${encodeURIComponent(fetchShim)}`]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('BDR processing smoke OK');
  });

  it('keeps optimized BDR runtime diagnostics and duration config aligned', () => {
    const diagnostics = read('lib/mcp/diagnostics.ts');
    const vercelConfig = read('vercel.json');
    const route = read('app/api/internal/process-batch/[batchId]/route.ts');

    expect(diagnostics).toContain('BDR_PROMPT_PACK_REVISION');
    expect(diagnostics).toContain('optimized_dossier_path');
    expect(diagnostics).toContain('fallback_causes');
    expect(diagnostics).toContain('structured_ai_sdk');
    expect(diagnostics).toContain('browserbase');
    expect(diagnostics).toContain('missing_optional');
    expect(route).toContain('maxDuration = 300');
    expect(vercelConfig).toMatch(/app\/api\/internal\/process-batch\/\[batchId\]\/route\.ts"[\s\S]*"maxDuration": 300/);
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
