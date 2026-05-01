#!/usr/bin/env node

const rawUrl = process.argv[2] ?? process.env.MCP_URL ?? process.env.APP_BASE_URL;
if (!rawUrl) {
  console.error('MCP URL is required. Pass a URL or set MCP_URL or APP_BASE_URL.');
  process.exit(1);
}

if (!process.env.BDR_SMOKE_ACTOR_EMAIL) {
  console.error('BDR_SMOKE_ACTOR_EMAIL is required so smoke batches are traceable.');
  process.exit(1);
}

const endpoint = rawUrl.endsWith('/api/mcp')
  ? rawUrl
  : `${rawUrl.replace(/\/$/, '')}/api/mcp`;

const headers = { 'content-type': 'application/json' };
if (process.env.MCP_API_SECRET) {
  headers.authorization = `Bearer ${process.env.MCP_API_SECRET}`;
}

const genericFallbackPattern = /handoffs without the reset|full conversation history|before it becomes urgent|KUHL: 44% reduction in WISMO emails/i;
const smokeCorrelationId = process.env.BDR_SMOKE_CORRELATION_ID ?? `bdr-smoke-${Date.now()}`;
const smokeCompanyName = process.env.BDR_SMOKE_COMPANY_NAME ?? 'Gruns';
const smokeCompanyDomain = process.env.BDR_SMOKE_COMPANY_DOMAIN ?? 'gruns.co';
const smokeContactName = process.env.BDR_SMOKE_CONTACT_NAME ?? 'Jillian';
const smokeContactTitle = process.env.BDR_SMOKE_CONTACT_TITLE ?? 'Director of Customer Experience';

async function parseJsonResponse(response, label) {
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} did not return JSON (${response.status}): ${text.slice(0, 160)}`);
  }
  if (!response.ok) {
    const message = body?.error?.message ?? body?.error ?? response.statusText;
    throw new Error(`${label} failed (${response.status}): ${message}`);
  }
  return body;
}

async function callMcpTool(name, args) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `bdr-smoke-${name}`,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  const body = await parseJsonResponse(response, name);
  if (body?.result?.isError) {
    throw new Error(`${name} returned a tool error: ${body.result.structuredContent?.error ?? body.result.content?.[0]?.text ?? 'unknown error'}`);
  }
  return body.result?.structuredContent;
}

function assertBdrDiagnostics(result, label) {
  if (result?.diagnostics?.processing_route !== 'bdr_workflow') {
    throw new Error(`${label} did not report BDR workflow routing. Diagnostics: ${JSON.stringify(result?.diagnostics ?? {})}`);
  }
  if (process.env.BDR_SMOKE_REQUIRE_VERCEL === 'true' && result?.diagnostics?.runtime !== 'vercel') {
    throw new Error(`${label} did not report Vercel runtime. Diagnostics: ${JSON.stringify(result?.diagnostics ?? {})}`);
  }
  if (process.env.BDR_SMOKE_REQUIRE_DATABASE === 'true' && !['database', 'database_required'].includes(result?.diagnostics?.persistence)) {
    throw new Error(`${label} did not report database persistence. Diagnostics: ${JSON.stringify(result?.diagnostics ?? {})}`);
  }
  if (!result?.diagnostics?.deployment?.contract_revision) {
    throw new Error(`${label} did not report deployment contract revision. Diagnostics: ${JSON.stringify(result?.diagnostics ?? {})}`);
  }
}

function reviewStateUrl(reviewUrl) {
  const parsed = new URL(reviewUrl);
  const match = parsed.pathname.match(/\/review\/batch\/([^/]+)/);
  if (!match) throw new Error(`Could not parse batch review token from ${reviewUrl}`);
  parsed.pathname = `/api/review/batch/${match[1]}/state`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

async function fetchReviewState(reviewUrl) {
  const response = await fetch(reviewStateUrl(reviewUrl), { headers });
  return parseJsonResponse(response, 'batch review state');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

try {
  const create = await callMcpTool('create_outbound_sequence', {
    actor: {
      email: process.env.BDR_SMOKE_ACTOR_EMAIL,
      cowork_thread_id: process.env.BDR_SMOKE_THREAD_ID ?? `bdr-smoke-${Date.now()}`,
    },
    play_id: 'bdr_cold_outbound',
    play_metadata: {
      intake: {
        confirmed_play: 'bdr_cold_outbound',
        user_request_summary: `Controlled BDR smoke for routing verification. correlation=${smokeCorrelationId}`,
        smoke_correlation_id: smokeCorrelationId,
        push_intent: 'review_first',
      },
    },
    companies: [{
      company_name: smokeCompanyName,
      domain: smokeCompanyDomain,
      contacts: [{
        name: smokeContactName,
        title: smokeContactTitle,
      }],
    }],
    mode: 'fast',
  });

  assertBdrDiagnostics(create, 'create_outbound_sequence');

  let status = create;
  const maxAttempts = Number(process.env.BDR_SMOKE_MAX_POLLS ?? create.max_poll_attempts ?? 8);
  const pollDelayMs = Number(process.env.BDR_SMOKE_POLL_INTERVAL_MS ?? (create.recommended_poll_after_seconds ? create.recommended_poll_after_seconds * 1000 : 30000));

  for (let attempt = 0; attempt < maxAttempts && !status.is_terminal; attempt += 1) {
    await wait(pollDelayMs);
    status = await callMcpTool('get_outbound_sequence_status', {
      batch_id: create.batch_id,
      actor: { email: process.env.BDR_SMOKE_ACTOR_EMAIL },
    });
    assertBdrDiagnostics(status, 'get_outbound_sequence_status');
  }

  if (status.status !== 'ready_for_review') {
    throw new Error(`BDR smoke did not reach ready_for_review. batch_id=${create.batch_id} status=${status.status}`);
  }

  const reviewState = await fetchReviewState(status.review_url);
  const serializedReview = JSON.stringify(reviewState);

  if (genericFallbackPattern.test(serializedReview)) {
    throw new Error(`BDR smoke produced generic company-agent fallback copy. batch_id=${create.batch_id}`);
  }
  if (!serializedReview.includes('bdr_cold_outbound')) {
    throw new Error(`BDR smoke review state does not include BDR play markers. batch_id=${create.batch_id}`);
  }

  console.log(`BDR processing smoke OK: batch_id=${create.batch_id} correlation=${smokeCorrelationId} route=${status.diagnostics.processing_route} runtime=${status.diagnostics.runtime} persistence=${status.diagnostics.persistence} contract_revision=${status.diagnostics.deployment.contract_revision}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
