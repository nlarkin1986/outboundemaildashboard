#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const DEFAULT_COMPANIES = [
  { company_name: 'Gruns' },
  { company_name: 'The Black Tux' },
  { company_name: 'Quince' },
  { company_name: 'Manscapped' },
  { company_name: 'Alo Yoga' },
];

const BDR_PLAY_ID = 'bdr_cold_outbound';
const TARGET_PERSONA = 'CX leaders';
const DEFAULT_OUTPUT_DIR = 'tmp/bdr-live-e2e-eval';

const rawUrl = process.argv[2] ?? process.env.MCP_URL ?? process.env.APP_BASE_URL;
if (!rawUrl) {
  console.error('MCP URL is required. Pass a URL or set MCP_URL or APP_BASE_URL.');
  process.exit(1);
}

if (!process.env.BDR_EVAL_ACTOR_EMAIL) {
  console.error('BDR_EVAL_ACTOR_EMAIL is required so eval batches are traceable.');
  process.exit(1);
}

function normalizeEndpoint(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('unsupported protocol');
    if (!parsed.pathname.endsWith('/api/mcp')) parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}/api/mcp`;
    return parsed.toString();
  } catch {
    console.error(`MCP URL must be an absolute http(s) URL, got: ${value}`);
    console.error('Set APP_BASE_URL to your deployed app URL, for example: APP_BASE_URL="https://your-app.vercel.app"');
    process.exit(1);
  }
}

const endpoint = normalizeEndpoint(rawUrl);
const endpointUrl = new URL(endpoint);
const headers = { 'content-type': 'application/json' };
if (process.env.MCP_API_SECRET) {
  headers.authorization = `Bearer ${process.env.MCP_API_SECRET}`;
}

const runStartedAt = new Date();
const runId = process.env.BDR_EVAL_CORRELATION_ID ?? `bdr-live-e2e-${runStartedAt.toISOString().replace(/[:.]/g, '-')}`;

const genericFallbackPattern = /handoffs without the reset|full conversation history|before it becomes urgent|KUHL: 44% reduction in WISMO emails/i;
const internalBdrLeakPattern = /confirm the right BDR sequence|\[SELECTED_INSERT\]|PERSONALIZE|tool trace|raw prompt|system prompt|developer message|function_call|BDR A-1 template fallback used|Template benchmark fallback used/i;
const bracketPlaceholderPattern = /\[(?:PRODUCT_OR_COLLECTION|PRODUCT_OR_CATEGORY|DIGITAL_SIGNAL|SUBSCRIPTION_SIGNAL|REVIEW_PATTERN|OPEN_SUPPORT_ROLES|SELECTED_INSERT)\]/i;
const secretLikePattern = /\b(?:api[_-]?key|database_url|bearer\s+[A-Za-z0-9._-]{8,}|sk-[A-Za-z0-9._-]{12,})\b/i;
const cxLeaderPattern = /\b(?:chief|vp|vice president|director|head|lead|leader|manager|officer)\b.*\b(?:cx|customer|experience|support|care|service|success|e-?commerce|digital)\b|\b(?:cx|customer|experience|support|care|service|success|e-?commerce|digital)\b.*\b(?:chief|vp|vice president|director|head|lead|leader|manager|officer)\b/i;
const safeFallbackWarningPattern = /weak evidence|provider|agent failure|fallback|no verified|non-pushable|blocked|sequence mapping|unsupported/i;

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company';
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function uniquePush(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

function parseCompaniesCsv(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [name, domain] = item.split('|').map((part) => part.trim());
      return domain ? { company_name: name, domain } : { company_name: name };
    });
}

function normalizeCompanyInput(item) {
  if (typeof item === 'string') return { company_name: item };
  if (item && typeof item.company_name === 'string') {
    return {
      company_name: item.company_name,
      ...(typeof item.domain === 'string' && item.domain.trim() ? { domain: item.domain.trim() } : {}),
    };
  }
  throw new Error(`Invalid company input: ${JSON.stringify(item)}`);
}

async function companiesFromRerunArtifact(path) {
  const artifact = JSON.parse(await readFile(resolve(path), 'utf8'));
  const rows = Array.isArray(artifact?.rows) ? artifact.rows : [];
  return rows
    .filter((row) => row?.result === 'warn' || row?.result === 'fail')
    .map((row) => normalizeCompanyInput(row.input_company ?? { company_name: row.company_name, domain: row.domain }));
}

async function resolveCompanies() {
  if (process.env.BDR_EVAL_RERUN_FROM) {
    const companies = await companiesFromRerunArtifact(process.env.BDR_EVAL_RERUN_FROM);
    if (companies.length === 0) throw new Error(`No warn/fail rows found in ${process.env.BDR_EVAL_RERUN_FROM}`);
    return companies;
  }
  if (process.env.BDR_EVAL_COMPANIES_JSON) {
    const parsed = JSON.parse(process.env.BDR_EVAL_COMPANIES_JSON);
    if (!Array.isArray(parsed)) throw new Error('BDR_EVAL_COMPANIES_JSON must be a JSON array.');
    return parsed.map(normalizeCompanyInput);
  }
  if (process.env.BDR_EVAL_COMPANIES) return parseCompaniesCsv(process.env.BDR_EVAL_COMPANIES);
  return DEFAULT_COMPANIES;
}

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
      id: `${runId}-${name}`,
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
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function buildCreateArgs(company) {
  const companySlug = slug(company.company_name);
  return {
    actor: {
      email: process.env.BDR_EVAL_ACTOR_EMAIL,
      cowork_thread_id: `${runId}-${companySlug}`,
    },
    play_id: BDR_PLAY_ID,
    play_metadata: {
      intake: {
        confirmed_play: BDR_PLAY_ID,
        user_request_summary: `Live BDR eval for ${company.company_name}; company-only input targeting ${TARGET_PERSONA}. correlation=${runId}`,
        live_eval_correlation_id: runId,
        eval_company: company.company_name,
        target_persona: TARGET_PERSONA,
        push_intent: 'review_first',
      },
    },
    request_context: `Live BDR eval: create review-first BDR drafts for ${company.company_name}; company-only input; target persona ${TARGET_PERSONA}.`,
    target_persona: TARGET_PERSONA,
    companies: [{ ...company }],
    mode: process.env.BDR_EVAL_MODE === 'deep' ? 'deep' : 'fast',
    ...(process.env.BDR_EVAL_CAMPAIGN_ID ? { campaign_id: process.env.BDR_EVAL_CAMPAIGN_ID } : {}),
  };
}

function baseRow(company) {
  const ambiguityNotes = [];
  if (company.company_name.trim().toLowerCase() === 'manscapped' && !company.domain) {
    ambiguityNotes.push('Input kept literal: "Manscapped" is ambiguous and may mean MANSCAPED; supply a domain or normalized name to disambiguate.');
  }
  return {
    company_name: company.company_name,
    domain: company.domain,
    input_company: company,
    result: 'fail',
    status: 'not_started',
    batch_id: undefined,
    review_url: undefined,
    dashboard_status_url: undefined,
    route: undefined,
    runtime: undefined,
    persistence: undefined,
    contact: undefined,
    pushability: 'unknown',
    sequence_code: undefined,
    diagnostics: undefined,
    ambiguity_notes: ambiguityNotes,
    hard_failures: [],
    warnings: [...ambiguityNotes],
    quality_notes: [],
  };
}

function summarizeDiagnostics(diagnostics) {
  if (!diagnostics) return undefined;
  return {
    processing_route: diagnostics.processing_route,
    runtime: diagnostics.runtime,
    persistence: diagnostics.persistence,
    deployment: {
      contract_revision: diagnostics.deployment?.contract_revision,
      prompt_pack_revision: diagnostics.deployment?.prompt_pack_revision,
    },
    research_providers: diagnostics.research_providers,
    bdr_personalization: {
      optimized_dossier_path: diagnostics.bdr_personalization?.optimized_dossier_path,
      final_synthesis: diagnostics.bdr_personalization?.final_synthesis,
      fallback_causes: Array.isArray(diagnostics.bdr_personalization?.fallback_causes)
        ? diagnostics.bdr_personalization.fallback_causes
        : undefined,
    },
  };
}

function classifyDiagnostics(row, diagnostics, label) {
  if (!diagnostics) {
    uniquePush(row.hard_failures, `${label} did not include diagnostics.`);
    return;
  }
  row.route = diagnostics.processing_route;
  row.runtime = diagnostics.runtime;
  row.persistence = diagnostics.persistence;
  row.diagnostics = summarizeDiagnostics(diagnostics);

  if (diagnostics.processing_route !== 'bdr_workflow') {
    uniquePush(row.hard_failures, diagnostics.processing_route === 'generic_company_agent'
      ? `${label} routed through generic_company_agent instead of bdr_workflow.`
      : `${label} routed through ${diagnostics.processing_route ?? 'unknown'} instead of bdr_workflow.`);
  }
  if (!diagnostics.runtime) uniquePush(row.hard_failures, `${label} did not report runtime diagnostics.`);
  if (!diagnostics.persistence) uniquePush(row.hard_failures, `${label} did not report persistence diagnostics.`);
  if (!diagnostics.deployment?.contract_revision) uniquePush(row.hard_failures, `${label} did not report deployment contract_revision.`);
  if (!diagnostics.deployment?.prompt_pack_revision) uniquePush(row.hard_failures, `${label} did not report BDR prompt_pack_revision.`);
  if (!diagnostics.bdr_personalization?.optimized_dossier_path) uniquePush(row.hard_failures, `${label} did not report optimized_dossier_path diagnostics.`);
  if (!Array.isArray(diagnostics.bdr_personalization?.fallback_causes)) uniquePush(row.hard_failures, `${label} did not report BDR fallback_causes diagnostics.`);
}

function hasRealEmail(contact) {
  return Boolean(contact?.email && !String(contact.email).endsWith('.invalid'));
}

function isDraftBlocked(contact) {
  return Boolean(contact?.play_metadata?.draft_generation_blocked) || !contact?.sequence_code;
}

function classifyPushability(row, contact, runPlayId) {
  const realEmail = hasRealEmail(contact);
  const bdrBlocked = (runPlayId === BDR_PLAY_ID || contact?.play_metadata?.play_id === BDR_PLAY_ID) && isDraftBlocked(contact);
  const approved = contact?.status === 'approved';

  if (approved && (!realEmail || bdrBlocked)) {
    uniquePush(row.hard_failures, 'Contact appears approved/pushable despite a missing email or blocked BDR sequence.');
  }
  if (!realEmail) uniquePush(row.warnings, 'No verified contact email; contact must remain non-pushable until a real email is added.');
  if (bdrBlocked) uniquePush(row.warnings, 'BDR draft generation is blocked until a supported CX persona and sequence mapping are confirmed.');

  if (approved && realEmail && !bdrBlocked) return 'approved_real_email_sendable';
  if (!realEmail) return 'non_pushable_missing_email';
  if (bdrBlocked) return 'non_pushable_blocked_sequence';
  return 'review_required';
}

function emailText(contact) {
  return (contact?.emails ?? [])
    .map((email) => `${email.step_label ?? ''}\n${email.subject ?? ''}\n${email.body_text ?? ''}\n${email.body_html ?? ''}`)
    .join('\n\n');
}

function classifyBannedText(row, reviewState) {
  const serializedReview = JSON.stringify(reviewState);
  if (genericFallbackPattern.test(serializedReview)) {
    uniquePush(row.hard_failures, 'Review state contains generic company-agent fallback copy.');
  }
  if (internalBdrLeakPattern.test(serializedReview)) {
    uniquePush(row.hard_failures, 'Review state exposes internal BDR prompt/tool text.');
  }
  if (bracketPlaceholderPattern.test(serializedReview)) {
    uniquePush(row.hard_failures, 'Review state contains unresolved BDR bracket placeholders.');
  }
  if (secretLikePattern.test(serializedReview)) {
    uniquePush(row.hard_failures, 'Review state contains secret-like text.');
  }
}

function classifyContactQuality(row, contact, runPlayId) {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || undefined;
  row.contact = {
    name,
    title: contact.title,
    email: contact.email,
    status: contact.status,
  };
  row.sequence_code = contact.sequence_code;
  row.pushability = classifyPushability(row, contact, runPlayId);

  const warningText = (contact.qa_warnings ?? []).join(' ');
  for (const warning of contact.qa_warnings ?? []) uniquePush(row.warnings, warning);
  if (!contact.title || !cxLeaderPattern.test(contact.title)) {
    uniquePush(row.warnings, 'No credible CX leader title was discovered for the company-only input.');
  }
  if (safeFallbackWarningPattern.test(warningText)) {
    uniquePush(row.quality_notes, 'BDR fallback/warning behavior was explicit in review QA warnings.');
  }

  const personalization = contact.play_metadata?.personalization;
  const step1 = personalization?.step1;
  const step4 = personalization?.step4;
  if (!contact.sequence_code) {
    if (contact.play_metadata?.draft_generation_blocked) {
      uniquePush(row.warnings, 'Unsupported or missing persona sequence mapping safely blocked draft generation.');
    } else {
      uniquePush(row.hard_failures, 'BDR contact has no sequence_code and is not marked draft_generation_blocked.');
    }
    return;
  }

  const emails = Array.isArray(contact.emails) ? contact.emails : [];
  const stepNumbers = emails.map((email) => email.original_step_number ?? email.step_number);
  if (!stepNumbers.includes(1) || !stepNumbers.includes(4) || emails.length < 2) {
    uniquePush(row.hard_failures, 'Mapped BDR sequence is missing expected Step 1 and Step 4 email drafts.');
  }
  if (emails.some((email) => !email.subject || !(email.body_text || email.body_html))) {
    uniquePush(row.hard_failures, 'Mapped BDR sequence contains an empty subject or body.');
  }
  if (bracketPlaceholderPattern.test(emailText(contact))) {
    uniquePush(row.hard_failures, 'Mapped BDR sequence email contains unresolved bracket placeholders.');
  }
  if (!Array.isArray(contact.evidence_urls) || contact.evidence_urls.length === 0) {
    uniquePush(row.warnings, 'No source evidence URLs were attached to the BDR contact.');
  }
  if (!step1 || step1.fallback_used) {
    uniquePush(row.warnings, 'Step 1 personalization used safe fallback or did not include a selected insert.');
  }
  if (!step4 || step4.fallback_used) {
    uniquePush(row.warnings, 'Step 4 personalization used safe fallback or did not include a selected insert.');
  }
  if (step1?.source_url || step4?.source_url || (contact.evidence_urls ?? []).length > 0) {
    uniquePush(row.quality_notes, 'Source-backed BDR personalization evidence was present.');
  }
}

function classifyReviewState(row, reviewState) {
  classifyBannedText(row, reviewState);
  if (reviewState?.batch?.play_id && reviewState.batch.play_id !== BDR_PLAY_ID) {
    uniquePush(row.hard_failures, `Review batch play_id was ${reviewState.batch.play_id}, expected ${BDR_PLAY_ID}.`);
  }
  const contacts = (reviewState?.runs ?? []).flatMap((run) => {
    const runPlayId = run.review?.run?.play_id ?? reviewState.batch?.play_id;
    return (run.review?.contacts ?? []).map((contact) => ({ runPlayId, contact }));
  });
  if (contacts.length === 0) {
    uniquePush(row.hard_failures, 'Review state did not include any contacts to inspect.');
    return;
  }
  classifyContactQuality(row, contacts[0].contact, contacts[0].runPlayId);
}

function finalizeRow(row) {
  row.result = row.hard_failures.length > 0 ? 'fail' : row.warnings.length > 0 ? 'warn' : 'pass';
  return row;
}

async function runCompany(company) {
  const row = baseRow(company);
  try {
    const create = await callMcpTool('create_outbound_sequence', buildCreateArgs(company));
    row.batch_id = create?.batch_id;
    row.status = create?.status ?? 'created';
    row.review_url = create?.review_url;
    row.dashboard_status_url = create?.dashboard_status_url;
    for (const warning of create?.warnings ?? []) uniquePush(row.warnings, warning);
    classifyDiagnostics(row, create?.diagnostics, 'create_outbound_sequence');

    let status = create;
    const maxAttempts = parsePositiveNumber(process.env.BDR_EVAL_MAX_POLLS, Number(create?.max_poll_attempts ?? 8));
    const pollDelayMs = parsePositiveNumber(process.env.BDR_EVAL_POLL_INTERVAL_MS, create?.recommended_poll_after_seconds ? create.recommended_poll_after_seconds * 1000 : 30000);
    for (let attempt = 0; attempt < maxAttempts && !status?.is_terminal; attempt += 1) {
      await wait(pollDelayMs);
      status = await callMcpTool('get_outbound_sequence_status', {
        batch_id: create.batch_id,
        actor: { email: process.env.BDR_EVAL_ACTOR_EMAIL },
      });
    }

    row.status = status?.status ?? row.status;
    row.review_url = status?.review_url ?? row.review_url;
    row.dashboard_status_url = status?.dashboard_status_url ?? row.dashboard_status_url;
    classifyDiagnostics(row, status?.diagnostics, 'get_outbound_sequence_status');
    for (const error of status?.errors ?? []) uniquePush(row.warnings, `Status error reported: ${error.error ?? JSON.stringify(error)}`);

    if (!status?.is_terminal) {
      uniquePush(row.hard_failures, `Timed out waiting for terminal status after ${maxAttempts} poll attempt(s).`);
      return finalizeRow(row);
    }
    if (!row.review_url) {
      uniquePush(row.hard_failures, 'No review_url was returned for the batch.');
      return finalizeRow(row);
    }
    if (status.status !== 'ready_for_review') {
      uniquePush(row.warnings, `Batch reached terminal status ${status.status} instead of ready_for_review.`);
    }

    const reviewState = await fetchReviewState(row.review_url);
    classifyReviewState(row, reviewState);
  } catch (error) {
    uniquePush(row.hard_failures, error instanceof Error ? error.message : String(error));
  }
  return finalizeRow(row);
}

function summarizeOverall(rows) {
  if (rows.some((row) => row.result === 'fail')) return 'fail';
  if (rows.some((row) => row.result === 'warn')) return 'warn';
  return 'pass';
}

function printSummary(rows, artifactPath) {
  const overall = summarizeOverall(rows);
  console.log(`BDR live E2E eval ${overall.toUpperCase()}: ${rows.length} compan${rows.length === 1 ? 'y' : 'ies'} checked. correlation=${runId}`);
  for (const row of rows) {
    const contact = row.contact ? `${row.contact.name ?? 'Unknown'}${row.contact.title ? ` (${row.contact.title})` : ''}` : 'No contact';
    const firstIssue = row.hard_failures[0] ?? row.warnings[0] ?? row.quality_notes[0] ?? 'OK';
    console.log([
      row.result.toUpperCase().padEnd(4),
      row.company_name,
      `status=${row.status}`,
      `batch=${row.batch_id ?? 'n/a'}`,
      `route=${row.route ?? 'n/a'}`,
      `contact=${contact}`,
      `pushability=${row.pushability}`,
      `sequence=${row.sequence_code ?? 'n/a'}`,
      `warnings=${row.warnings.length}`,
      `issue=${firstIssue}`,
    ].join(' | '));
  }
  console.log(`JSON artifact: ${artifactPath}`);
  if (overall === 'warn') console.log('Warning-only eval completed without hard failures; human review is still required before rollout.');
}

async function writeArtifact(rows, companies) {
  const outputDir = resolve(process.env.BDR_EVAL_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIR);
  await mkdir(outputDir, { recursive: true });
  const artifactPath = join(outputDir, `${runId}.json`);
  const artifact = {
    run_id: runId,
    started_at: runStartedAt.toISOString(),
    finished_at: new Date().toISOString(),
    target_persona: TARGET_PERSONA,
    play_id: BDR_PLAY_ID,
    input_companies: companies,
    endpoint: {
      origin: endpointUrl.origin,
      pathname: endpointUrl.pathname,
    },
    rerun_from: process.env.BDR_EVAL_RERUN_FROM,
    overall: summarizeOverall(rows),
    counts: {
      pass: rows.filter((row) => row.result === 'pass').length,
      warn: rows.filter((row) => row.result === 'warn').length,
      fail: rows.filter((row) => row.result === 'fail').length,
    },
    rows,
  };
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { artifact, artifactPath };
}

try {
  const companies = await resolveCompanies();
  const rows = [];
  for (const company of companies) {
    rows.push(await runCompany(company));
  }
  const { artifact, artifactPath } = await writeArtifact(rows, companies);
  printSummary(rows, artifactPath);
  if (artifact.overall === 'fail') process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
