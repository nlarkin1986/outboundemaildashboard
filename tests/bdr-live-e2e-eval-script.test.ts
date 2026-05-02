import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const script = resolve(root, 'scripts/verify-bdr-live-e2e-eval.mjs');
const origin = 'https://eval.example.test';

function runEval({
  args = [origin],
  env = {},
  shim = true,
}: {
  args?: string[];
  env?: Record<string, string | undefined>;
  shim?: boolean;
}) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolveRun, reject) => {
    const nodeArgs = shim ? ['--import', `data:text/javascript,${encodeURIComponent(fetchShim())}`] : [];
    const child = spawn(process.execPath, [...nodeArgs, script, ...args], {
      cwd: root,
      env: {
        ...process.env,
        MCP_URL: '',
        APP_BASE_URL: '',
        BDR_EVAL_OUTPUT_DIR: mkdtempSync(join(tmpdir(), 'bdr-live-e2e-default-')),
        BDR_EVAL_MAX_POLLS: '2',
        BDR_EVAL_POLL_INTERVAL_MS: '0',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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

function readOnlyArtifact(outputDir: string) {
  const files = readdirSync(outputDir).filter((file) => file.endsWith('.json'));
  expect(files).toHaveLength(1);
  return JSON.parse(readFileSync(join(outputDir, files[0]), 'utf8'));
}

function readFetchLog(path: string) {
  return readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function fetchShim() {
  return `
    import { appendFileSync } from 'node:fs';

    const origin = ${JSON.stringify(origin)};
    const scenario = process.env.BDR_EVAL_TEST_SCENARIO ?? 'happy';
    const logPath = process.env.BDR_EVAL_FETCH_LOG;
    const defaultDiagnostics = {
      processing_route: 'bdr_workflow',
      runtime: 'vercel',
      persistence: 'database',
      deployment: {
        contract_revision: 'bdr-test-contract',
        prompt_pack_revision: 'bdr-cold-outbound-inline-prompts-2026-05-02',
      },
      research_providers: {
        anthropic: 'configured',
        exa: 'configured',
        firecrawl: 'configured',
        browserbase: 'missing_optional',
      },
      bdr_personalization: {
        optimized_dossier_path: 'enabled',
        final_synthesis: 'structured_ai_sdk',
        fallback_causes: ['weak_evidence', 'provider_configuration', 'provider_failure', 'agent_failure', 'blocked_sequence_mapping'],
      },
    };

    function slug(value) {
      return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company';
    }

    function rpc(structuredContent) {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: 'test',
        result: {
          isError: false,
          structuredContent,
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    function diagnostics() {
      if (scenario === 'generic-route') return { ...defaultDiagnostics, processing_route: 'generic_company_agent', bdr_personalization: undefined };
      return defaultDiagnostics;
    }

    function reviewState(companyName) {
      const token = slug(companyName);
      const commonRun = {
        run: {
          id: 'run_' + token,
          company_name: companyName,
          play_id: 'bdr_cold_outbound',
        },
      };
      if (scenario === 'placeholder-warning') {
        return {
          batch: { id: 'batch_' + token, play_id: 'bdr_cold_outbound' },
          runs: [{
            run_id: 'run_' + token,
            review: {
              ...commonRun,
              contacts: [{
                id: 'contact_' + token,
                first_name: 'Account',
                last_name: 'Draft',
                title: 'Contact needed',
                company: companyName,
                email: 'missing-contact+' + token + '@example.invalid',
                status: 'needs_edit',
                play_metadata: {
                  play_id: 'bdr_cold_outbound',
                  draft_generation_blocked: true,
                  blocked_reason: 'missing_bdr_sequence_mapping',
                },
                evidence_urls: [],
                qa_warnings: [
                  'No verified contact email supplied; candidate is non-pushable until a real email is added.',
                  'Contact title is required for BDR sequence mapping.',
                ],
                emails: [{
                  id: 'email_' + token,
                  contact_id: 'contact_' + token,
                  step_number: 1,
                  original_step_number: 1,
                  step_label: 'Step 1: Email · needs sequence mapping',
                  subject: 'BDR sequence unavailable',
                  body_text: 'BDR email draft was not generated because this contact needs a supported BDR persona and sequence mapping.',
                  body_html: '<p>BDR email draft was not generated because this contact needs a supported BDR persona and sequence mapping.</p>',
                }],
              }],
            },
          }],
        };
      }
      const body = scenario === 'banned-copy'
        ? 'Avery, handoffs without the reset are getting messy.'
        : 'Avery, shoppers asking about fit before purchase creates CX-owned conversion risk.';
      return {
        batch: { id: 'batch_' + token, play_id: 'bdr_cold_outbound' },
        runs: [{
          run_id: 'run_' + token,
          review: {
            ...commonRun,
            contacts: [{
              id: 'contact_' + token,
              first_name: 'Avery',
              last_name: 'Morgan',
              title: 'VP of Customer Experience',
              company: companyName,
              email: 'avery@' + token + '.example',
              status: 'needs_edit',
              sequence_code: 'A-1',
              play_metadata: {
                play_id: 'bdr_cold_outbound',
                sequence_code: 'A-1',
                personalization: {
                  step1: {
                    selected_insert: companyName + ' fit guide',
                    confidence: 'medium',
                    evidence_type: 'public_fact',
                    source_url: 'https://example.com/' + token + '/fit',
                    fallback_used: false,
                  },
                  step4: {
                    selected_insert: companyName + ' reviews mention fit questions',
                    confidence: 'medium',
                    evidence_type: 'reviews',
                    source_url: 'https://example.com/' + token + '/reviews',
                    fallback_used: false,
                  },
                },
              },
              evidence_urls: ['https://example.com/' + token + '/fit', 'https://example.com/' + token + '/reviews'],
              qa_warnings: [],
              emails: [
                {
                  id: 'email1_' + token,
                  contact_id: 'contact_' + token,
                  step_number: 1,
                  original_step_number: 1,
                  step_label: 'Step 1: Email · peer story',
                  subject: "what Rothy's figured out about sizing",
                  body_text: body,
                  body_html: '<p>' + body + '</p>',
                },
                {
                  id: 'email2_' + token,
                  contact_id: 'contact_' + token,
                  step_number: 2,
                  original_step_number: 4,
                  step_label: 'Step 4: Email · benchmarks / data',
                  subject: 'cart abandonment recovery when support is real-time',
                  body_text: 'Avery, different angle. ' + companyName + ' reviews mention fit questions. That is usually fixable once the right routing is in place.',
                  body_html: '<p>Avery, different angle.</p>',
                },
              ],
            }],
          },
        }],
      };
    }

    globalThis.fetch = async (input, init = {}) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/mcp') {
        const body = JSON.parse(init.body);
        const tool = body.params?.name;
        const args = body.params?.arguments ?? {};
        if (logPath) appendFileSync(logPath, JSON.stringify({ tool, args }) + '\\n');
        if (tool === 'create_outbound_sequence') {
          const companyName = args.companies?.[0]?.company_name ?? 'Unknown';
          const token = slug(companyName);
          return rpc({
            ok: true,
            batch_id: 'batch_' + token,
            status: 'processing',
            play_id: 'bdr_cold_outbound',
            review_url: origin + '/review/batch/token_' + token,
            dashboard_status_url: origin + '/admin/runs?batch_id=batch_' + token,
            poll_tool: 'get_outbound_sequence_status',
            recommended_poll_after_seconds: 0,
            max_poll_attempts: 2,
            is_terminal: false,
            diagnostics: diagnostics(),
            routing: { selected_route: 'bdr_cold_outbound', source: 'explicit_play_id' },
            warnings: [],
          });
        }
        if (tool === 'get_outbound_sequence_status') {
          const token = String(args.batch_id ?? '').replace(/^batch_/, '');
          return rpc({
            ok: true,
            batch_id: args.batch_id,
            status: 'ready_for_review',
            play_id: 'bdr_cold_outbound',
            review_url: origin + '/review/batch/token_' + token,
            dashboard_status_url: origin + '/admin/runs?batch_id=' + args.batch_id,
            is_terminal: true,
            diagnostics: diagnostics(),
            processing: { state: 'completed', run_count: 1 },
            run_counts: { total: 1, ready_for_review: 1, failed: 0 },
            errors: [],
          });
        }
        return new Response(JSON.stringify({ error: 'unexpected tool' }), { status: 400, headers: { 'content-type': 'application/json' } });
      }
      const match = url.pathname.match(/\\/api\\/review\\/batch\\/token_(.+)\\/state/);
      if (match) {
        const bySlug = {
          gruns: 'Gruns',
          'the-black-tux': 'The Black Tux',
          quince: 'Quince',
          manscapped: 'Manscapped',
          'alo-yoga': 'Alo Yoga',
        };
        const companyName = bySlug[match[1]] ?? match[1];
        return new Response(JSON.stringify(reviewState(companyName)), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    };
  `;
}

describe('BDR live E2E eval script', () => {
  it('requires a deployed MCP URL', async () => {
    const result = await runEval({
      args: [],
      env: { BDR_EVAL_ACTOR_EMAIL: 'eval@example.com' },
      shim: false,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('MCP URL is required');
  });

  it('requires an actor email', async () => {
    const result = await runEval({ shim: false });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('BDR_EVAL_ACTOR_EMAIL is required');
  });

  it('runs default company-only BDR eval requests and writes warning artifacts for ambiguous Manscapped', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'bdr-live-e2e-output-'));
    const fetchLog = join(outputDir, 'fetch.jsonl');
    const result = await runEval({
      env: {
        BDR_EVAL_ACTOR_EMAIL: 'eval@example.com',
        BDR_EVAL_OUTPUT_DIR: outputDir,
        BDR_EVAL_FETCH_LOG: fetchLog,
      },
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('BDR live E2E eval WARN');

    const createCalls = readFetchLog(fetchLog).filter((entry) => entry.tool === 'create_outbound_sequence');
    expect(createCalls.map((entry) => entry.args.companies[0].company_name)).toEqual(['Gruns', 'The Black Tux', 'Quince', 'Manscapped', 'Alo Yoga']);
    expect(createCalls.every((entry) => entry.args.play_id === 'bdr_cold_outbound')).toBe(true);
    expect(createCalls.every((entry) => entry.args.target_persona === 'CX leaders')).toBe(true);
    expect(createCalls.every((entry) => !('contacts' in entry.args.companies[0]))).toBe(true);

    const artifact = readOnlyArtifact(outputDir);
    expect(artifact.overall).toBe('warn');
    expect(artifact.rows).toHaveLength(5);
    expect(artifact.rows.find((row: any) => row.company_name === 'Manscapped').warnings.join(' ')).toMatch(/ambiguous/);
    expect(JSON.stringify(artifact)).not.toContain('MCP_API_SECRET');
  });

  it('supports comma-separated company overrides', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'bdr-live-e2e-override-'));
    const fetchLog = join(outputDir, 'fetch.jsonl');
    const result = await runEval({
      env: {
        BDR_EVAL_ACTOR_EMAIL: 'eval@example.com',
        BDR_EVAL_OUTPUT_DIR: outputDir,
        BDR_EVAL_FETCH_LOG: fetchLog,
        BDR_EVAL_COMPANIES: 'Gruns,Alo Yoga',
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('BDR live E2E eval PASS');
    const createCalls = readFetchLog(fetchLog).filter((entry) => entry.tool === 'create_outbound_sequence');
    expect(createCalls.map((entry) => entry.args.companies[0].company_name)).toEqual(['Gruns', 'Alo Yoga']);
    expect(readOnlyArtifact(outputDir).overall).toBe('pass');
  });

  it('hard-fails generic company-agent routing', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'bdr-live-e2e-generic-'));
    const result = await runEval({
      env: {
        BDR_EVAL_ACTOR_EMAIL: 'eval@example.com',
        BDR_EVAL_OUTPUT_DIR: outputDir,
        BDR_EVAL_COMPANIES: 'Gruns',
        BDR_EVAL_TEST_SCENARIO: 'generic-route',
      },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('BDR live E2E eval FAIL');
    const artifact = readOnlyArtifact(outputDir);
    expect(artifact.rows[0].hard_failures.join(' ')).toMatch(/generic_company_agent/);
  });

  it('treats safe non-pushable placeholder output as a warning', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'bdr-live-e2e-placeholder-'));
    const result = await runEval({
      env: {
        BDR_EVAL_ACTOR_EMAIL: 'eval@example.com',
        BDR_EVAL_OUTPUT_DIR: outputDir,
        BDR_EVAL_COMPANIES: 'Gruns',
        BDR_EVAL_TEST_SCENARIO: 'placeholder-warning',
      },
    });

    expect(result.status).toBe(0);
    const artifact = readOnlyArtifact(outputDir);
    expect(artifact.overall).toBe('warn');
    expect(artifact.rows[0].hard_failures).toEqual([]);
    expect(artifact.rows[0].pushability).toBe('non_pushable_missing_email');
    expect(artifact.rows[0].warnings.join(' ')).toMatch(/No verified contact email/);
  });

  it('hard-fails stale generic fallback copy in review state', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'bdr-live-e2e-banned-'));
    const result = await runEval({
      env: {
        BDR_EVAL_ACTOR_EMAIL: 'eval@example.com',
        BDR_EVAL_OUTPUT_DIR: outputDir,
        BDR_EVAL_COMPANIES: 'Gruns',
        BDR_EVAL_TEST_SCENARIO: 'banned-copy',
      },
    });

    expect(result.status).toBe(1);
    const artifact = readOnlyArtifact(outputDir);
    expect(artifact.rows[0].hard_failures.join(' ')).toMatch(/generic company-agent fallback copy/);
  });

  it('reruns only warning and failing companies from a previous artifact', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'bdr-live-e2e-rerun-'));
    const fetchLog = join(outputDir, 'fetch.jsonl');
    const previousArtifact = join(outputDir, 'previous.json');
    writeFileSync(previousArtifact, JSON.stringify({
      rows: [
        { result: 'pass', company_name: 'Gruns', input_company: { company_name: 'Gruns' } },
        { result: 'warn', company_name: 'Manscapped', input_company: { company_name: 'Manscapped' } },
        { result: 'fail', company_name: 'Quince', input_company: { company_name: 'Quince', domain: 'onequince.com' } },
      ],
    }));

    const result = await runEval({
      env: {
        BDR_EVAL_ACTOR_EMAIL: 'eval@example.com',
        BDR_EVAL_OUTPUT_DIR: outputDir,
        BDR_EVAL_FETCH_LOG: fetchLog,
        BDR_EVAL_RERUN_FROM: previousArtifact,
      },
    });

    expect(result.status).toBe(0);
    const createCalls = readFetchLog(fetchLog).filter((entry) => entry.tool === 'create_outbound_sequence');
    expect(createCalls.map((entry) => entry.args.companies[0])).toEqual([
      { company_name: 'Manscapped' },
      { company_name: 'Quince', domain: 'onequince.com' },
    ]);
  });
});
