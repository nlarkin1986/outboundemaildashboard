import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { createBatchSchema, createRunSchema, saveBatchReviewSchema, saveReviewSchema, type CreateBatchInput, type CreateRunInput, type SaveBatchReviewInput, type SaveReviewInput } from './schemas';
import { query, transaction, iso } from './db';
import type { Batch, BatchReviewState, BatchRun, Contact, CoworkMessage, InstantlyPushPayload, ResearchArtifact, ReviewContact, ReviewEvent, ReviewState, Run, SequenceEmail } from './types';

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const reviewToken = () => crypto.randomBytes(32).toString('hex');
const tokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

function stripHtml(html: string) { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

function toRun(row: any, review_token = ''): Run {
  return {
    id: row.id,
    company_name: row.company_name,
    domain: row.domain ?? undefined,
    status: row.status,
    mode: row.mode,
    source: row.source,
    campaign_id: row.campaign_id ?? undefined,
    cowork_thread_id: row.cowork_thread_id ?? undefined,
    review_token,
    created_at: iso(row.created_at)!,
    updated_at: iso(row.updated_at)!,
  };
}

function toContact(row: any): Contact {
  return {
    id: row.id,
    run_id: row.run_id,
    first_name: row.first_name ?? undefined,
    last_name: row.last_name ?? undefined,
    title: row.title ?? undefined,
    company: row.company ?? undefined,
    email: row.email,
    domain: row.domain ?? undefined,
    status: row.status,
    primary_angle: row.primary_angle ?? undefined,
    opening_hook: row.opening_hook ?? undefined,
    proof_used: row.proof_used ?? undefined,
    guardrail: row.guardrail ?? undefined,
    evidence_urls: row.evidence_json ?? [],
    qa_warnings: row.qa_warnings_json ?? [],
  };
}

function toEmail(row: any): SequenceEmail {
  return {
    id: row.id,
    contact_id: row.contact_id,
    step_number: row.step_number,
    subject: row.subject,
    body_html: row.body_html,
    body_text: row.body_text ?? stripHtml(row.body_html),
    original_subject: row.original_subject ?? row.subject,
    original_body_html: row.original_body_html ?? row.body_html,
    edited_by: row.edited_by ?? undefined,
    edited_at: iso(row.edited_at),
  };
}

async function runQuery(client: PoolClient | undefined, text: string, params: unknown[] = []) {
  return client ? client.query(text, params) : query(text, params);
}

async function getRunOrThrow(runId: string, client?: PoolClient) {
  const result = await runQuery(client, 'select * from runs where id = $1', [runId]);
  const row = result.rows[0];
  if (!row) throw new Error(`Run not found: ${runId}`);
  return toRun(row);
}

async function contactsForRun(runId: string, client?: PoolClient): Promise<Contact[]> {
  const result = await runQuery(client, 'select * from contacts where run_id = $1 order by email asc', [runId]);
  return result.rows.map(toContact);
}

async function emailsForContact(contactId: string, client?: PoolClient): Promise<SequenceEmail[]> {
  const result = await runQuery(client, 'select * from sequence_emails where contact_id = $1 order by step_number asc', [contactId]);
  return result.rows.map(toEmail);
}

async function insertEvent(client: PoolClient, event: Omit<ReviewEvent, 'id' | 'created_at'> & { created_at?: string }) {
  await client.query(
    `insert into review_events (id, run_id, contact_id, actor, event_type, before_json, after_json, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id('event'), event.run_id, event.contact_id ?? null, event.actor ?? null, event.event_type, event.before_json ? JSON.stringify(event.before_json) : null, event.after_json ? JSON.stringify(event.after_json) : null, event.created_at ?? now()],
  );
}

export async function resetStore() {
  await query('truncate table cowork_messages, research_artifacts, batch_runs, batches, pushed_contacts, push_jobs, review_events, sequence_emails, contacts, runs restart identity cascade');
}

export async function createRun(input: CreateRunInput): Promise<Run & { contacts: Contact[] }> {
  const parsed = createRunSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid run payload: ${parsed.error.message}`);
  const data = parsed.data;
  const runId = id('run');
  const token = reviewToken();
  const timestamp = now();

  return transaction(async (client) => {
    const runResult = await client.query(
      `insert into runs (id, company_name, domain, status, mode, source, campaign_id, cowork_thread_id, review_token_hash, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) returning *`,
      [runId, data.company_name, data.domain ?? null, 'queued', data.mode, data.source, data.campaign_id ?? null, data.cowork_thread_id ?? null, tokenHash(token), timestamp],
    );
    const contacts: Contact[] = [];
    const seen = new Set<string>();
    for (const contact of data.contacts) {
      if (seen.has(contact.email)) continue;
      seen.add(contact.email);
      const contactResult = await client.query(
        `insert into contacts (id, run_id, first_name, last_name, title, company, email, domain, status, evidence_json, qa_warnings_json, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'needs_edit','[]'::jsonb,'[]'::jsonb,$9,$9) returning *`,
        [id('contact'), runId, contact.first_name ?? null, contact.last_name ?? null, contact.title ?? null, contact.company ?? data.company_name, contact.email, contact.domain ?? data.domain ?? null, timestamp],
      );
      contacts.push(toContact(contactResult.rows[0]));
    }
    await insertEvent(client, { run_id: runId, event_type: 'run_created', after_json: { contact_count: contacts.length }, created_at: timestamp });
    return clone({ ...toRun(runResult.rows[0], token), contacts });
  });
}

export async function listRuns(): Promise<Array<Run & { contact_count: number; approved_count: number }>> {
  const result = await query(
    `select r.*, count(c.id)::int as contact_count,
            count(c.id) filter (where c.status = 'approved')::int as approved_count
       from runs r left join contacts c on c.run_id = r.id
      group by r.id order by r.created_at desc`,
  );
  return result.rows.map((row) => clone({ ...toRun(row), contact_count: row.contact_count, approved_count: row.approved_count }));
}

export async function getRun(runId: string): Promise<(Run & { contacts: ReviewContact[] }) | null> {
  const runResult = await query('select * from runs where id = $1', [runId]);
  if (!runResult.rows[0]) return null;
  const contacts = await contactsForRun(runId);
  const reviewContacts = await Promise.all(contacts.map(async (c) => ({ ...c, emails: await emailsForContact(c.id) })));
  return clone({ ...toRun(runResult.rows[0]), contacts: reviewContacts });
}

export async function generateDraftForRun(runId: string): Promise<ReviewState> {
  return transaction(async (client) => {
    const run = await getRunOrThrow(runId, client);
    await client.query(`update runs set status = 'writing', updated_at = $2 where id = $1`, [run.id, now()]);
    const contacts = await contactsForRun(run.id, client);
    for (const contact of contacts) {
      const first = contact.first_name || 'there';
      const updates = {
        primary_angle: contact.primary_angle ?? 'urgent handoffs where the next person needs the full customer story',
        opening_hook: contact.opening_hook ?? `When ${run.company_name} customers move across channels, the next person should not make them repeat the issue.`,
        proof_used: contact.proof_used ?? 'KUHL: 44% reduction in WISMO emails; 79% email resolution rate',
        guardrail: contact.guardrail ?? 'Personalization should use public evidence and clearly label inference; no unsupported internal claims.',
        evidence_urls: contact.evidence_urls.length ? contact.evidence_urls : [`https://${run.domain ?? contact.domain ?? 'example.com'}`],
        qa_warnings: contact.qa_warnings ?? [],
      };
      await client.query(
        `update contacts set primary_angle=$2, opening_hook=$3, proof_used=$4, guardrail=$5, evidence_json=$6::jsonb, qa_warnings_json=$7::jsonb, updated_at=$8 where id=$1`,
        [contact.id, updates.primary_angle, updates.opening_hook, updates.proof_used, updates.guardrail, JSON.stringify(updates.evidence_urls), JSON.stringify(updates.qa_warnings), now()],
      );
      const existingEmails = await emailsForContact(contact.id, client);
      if (existingEmails.length === 0) {
        const drafts = [
          ['event-date handoffs', `<p>Hi ${first},</p><p>When a customer issue becomes urgent, the handoff cannot feel like a reset.</p><p>Gladly helps teams give agents the full customer story across channels, so customers do not have to repeat themselves.</p>`],
          ['handoffs that do not reset', `<p>Hi ${first},</p><p>The operational risk is not just response time. It is whether the next teammate can see the prior conversation, order details, and urgency right away.</p><p>Worth comparing notes on where that shows up for ${run.company_name}?</p>`],
          ['before it becomes urgent', `<p>Hi ${first},</p><p>Last note from me. Gladly is built around the customer rather than the ticket, which helps teams route and resolve urgent conversations with the right history attached.</p><p>Open to a quick look?</p>`],
        ] as const;
        for (let index = 0; index < drafts.length; index++) {
          const [subject, body] = drafts[index];
          await client.query(
            `insert into sequence_emails (id, contact_id, step_number, subject, body_html, body_text, original_subject, original_body_html)
             values ($1,$2,$3,$4,$5,$6,$4,$5)`,
            [id('email'), contact.id, index + 1, subject, body, stripHtml(body)],
          );
        }
      }
    }
    await client.query(`update runs set status = 'ready_for_review', updated_at = $2 where id = $1`, [run.id, now()]);
    await insertEvent(client, { run_id: run.id, event_type: 'draft_generated', after_json: { contact_count: contacts.length } });
    const tokenResult = await client.query('select review_token_hash from runs where id=$1', [run.id]);
    // Cannot reconstruct token from hash. Return by loading state through a direct helper shape instead.
    const refreshedContacts = await contactsForRun(run.id, client);
    const reviewContacts = await Promise.all(refreshedContacts.map(async (c) => ({ ...c, emails: await emailsForContact(c.id, client) })));
    return clone({ run: { ...run, status: 'ready_for_review', updated_at: now() }, contacts: reviewContacts });
  });
}

export async function getReviewStateByToken(token: string): Promise<ReviewState> {
  const runResult = await query('select * from runs where review_token_hash = $1', [tokenHash(token)]);
  const row = runResult.rows[0];
  if (!row) throw new Error('Review token not found');
  const run = toRun(row, token);
  const contacts = await contactsForRun(run.id);
  const reviewContacts = await Promise.all(contacts.map(async (contact) => ({ ...contact, emails: await emailsForContact(contact.id) })));
  return clone({ run, contacts: reviewContacts });
}

export async function saveReviewState(token: string, input: SaveReviewInput, actor = 'anonymous'): Promise<{ ok: true; saved_at: string }> {
  const parsed = saveReviewSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid review payload: ${parsed.error.message}`);
  const state = await getReviewStateByToken(token);
  const timestamp = now();
  return transaction(async (client) => {
    for (const incoming of parsed.data.contacts) {
      const existingResult = await client.query('select * from contacts where id = $1 and run_id = $2', [incoming.id, state.run.id]);
      if (!existingResult.rows[0]) throw new Error(`Contact not found for review token: ${incoming.id}`);
      const existing = toContact(existingResult.rows[0]);
      const before = { ...existing, emails: await emailsForContact(existing.id, client) };
      await client.query(
        `update contacts set status=$2, primary_angle=$3, opening_hook=$4, proof_used=$5, guardrail=$6, evidence_json=$7::jsonb, qa_warnings_json=$8::jsonb, updated_at=$9 where id=$1`,
        [incoming.id, incoming.status, incoming.primary_angle ?? null, incoming.opening_hook ?? null, incoming.proof_used ?? null, incoming.guardrail ?? null, JSON.stringify(incoming.evidence_urls ?? existing.evidence_urls), JSON.stringify(incoming.qa_warnings ?? existing.qa_warnings), timestamp],
      );
      for (const email of incoming.emails) {
        const emailResult = await client.query('select * from sequence_emails where contact_id=$1 and step_number=$2', [existing.id, email.step_number]);
        if (!emailResult.rows[0]) throw new Error(`Email step ${email.step_number} not found for ${existing.email}`);
        await client.query(
          `update sequence_emails set subject=$3, body_html=$4, body_text=$5, edited_by=$6, edited_at=$7, updated_at=$7 where contact_id=$1 and step_number=$2`,
          [existing.id, email.step_number, email.subject, email.body_html, email.body_text ?? stripHtml(email.body_html), actor, timestamp],
        );
      }
      const afterContactResult = await client.query('select * from contacts where id=$1', [existing.id]);
      const after = { ...toContact(afterContactResult.rows[0]), emails: await emailsForContact(existing.id, client) };
      await insertEvent(client, { run_id: state.run.id, contact_id: existing.id, actor, event_type: 'review_saved', before_json: before, after_json: after, created_at: timestamp });
    }
    await client.query('update runs set updated_at=$2 where id=$1', [state.run.id, timestamp]);
    return { ok: true, saved_at: timestamp };
  });
}

export async function submitApproved(token: string, actor = 'anonymous'): Promise<{ ok: true; approved_count: number; push_job_id: string; status: string }> {
  const state = await getReviewStateByToken(token);
  const approved = state.contacts.filter((c) => c.status === 'approved');
  if (approved.length === 0) throw new Error('At least one approved contact is required before submit');
  const timestamp = now();
  return transaction(async (client) => {
    await client.query(`update runs set status='review_submitted', updated_at=$2 where id=$1`, [state.run.id, timestamp]);
    const jobId = id('push');
    await client.query(
      `insert into push_jobs (id, run_id, status, instantly_campaign_id, idempotency_key, attempts, created_at, updated_at)
       values ($1,$2,'queued',$3,$4,0,$5,$5)`,
      [jobId, state.run.id, state.run.campaign_id ?? null, `push:${state.run.id}`, timestamp],
    );
    await insertEvent(client, { run_id: state.run.id, actor, event_type: 'review_submitted', after_json: { approved_count: approved.length, push_job_id: jobId }, created_at: timestamp });
    return { ok: true, approved_count: approved.length, push_job_id: jobId, status: 'queued_for_push' };
  });
}

export type InstantlyPusher = (payload: InstantlyPushPayload) => Promise<{ instantly_lead_id?: string; campaign_paused: boolean; raw?: unknown }>;

export async function pushApprovedContacts(runId: string, pusher: InstantlyPusher): Promise<{ ok: true; pushed: number; failed: number; campaign_paused: boolean }> {
  const run = await getRunOrThrow(runId);
  if (run.status === 'pushed') return { ok: true, pushed: 0, failed: 0, campaign_paused: true };
  if (run.status !== 'review_submitted' && run.status !== 'pushing' && run.status !== 'partially_failed') throw new Error('Run must be review_submitted before push');
  await query(`update runs set status='pushing', updated_at=$2 where id=$1`, [run.id, now()]);
  let pushed = 0;
  let failed = 0;
  const contacts = (await contactsForRun(run.id)).filter((c) => c.status === 'approved' && c.email && !c.email.endsWith('.invalid'));
  for (const contact of contacts) {
    const key = `${run.id}:${contact.id}`;
    const existing = await query('select id from pushed_contacts where run_id=$1 and contact_id=$2', [run.id, contact.id]);
    if (existing.rows[0]) continue;
    const rowId = id('pushed');
    try {
      await query(
        `insert into pushed_contacts (id, run_id, contact_id, instantly_campaign_id, status, created_at)
         values ($1,$2,$3,$4,'running',$5) on conflict (run_id, contact_id) do nothing`,
        [rowId, run.id, contact.id, run.campaign_id ?? null, now()],
      );
      const result = await pusher({ email: contact.email, first_name: contact.first_name, last_name: contact.last_name, company: contact.company, title: contact.title, campaign_id: run.campaign_id, emails: await emailsForContact(contact.id), idempotency_key: key });
      if (!result.campaign_paused) throw new Error('Instantly campaign was not confirmed paused');
      await query(`update pushed_contacts set status='completed', instantly_lead_id=$3, response_json=$4::jsonb where run_id=$1 and contact_id=$2`, [run.id, contact.id, result.instantly_lead_id ?? null, JSON.stringify(result.raw ?? result)]);
      await query(`insert into review_events (id, run_id, contact_id, event_type, after_json, created_at) values ($1,$2,$3,'contact_pushed',$4::jsonb,$5)`, [id('event'), run.id, contact.id, JSON.stringify(result), now()]);
      pushed += 1;
    } catch (error) {
      await query(`delete from pushed_contacts where run_id=$1 and contact_id=$2 and status='running'`, [run.id, contact.id]);
      await query(`insert into review_events (id, run_id, contact_id, event_type, after_json, created_at) values ($1,$2,$3,'contact_push_failed',$4::jsonb,$5)`, [id('event'), run.id, contact.id, JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), now()]);
      failed += 1;
    }
  }
  await query(`update runs set status=$2, updated_at=$3 where id=$1`, [run.id, failed ? 'partially_failed' : 'pushed', now()]);
  return { ok: true, pushed, failed, campaign_paused: true };
}


function reviewUrlForBatchTokenLocal(token: string) {
  const base = process.env.APP_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return `${base}/review/batch/${token}`;
}

function toBatch(row: any, review_token = ''): Batch & { companies: Array<{ company_name: string; domain?: string; contacts?: any[] }> } {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    requested_by: row.requested_by ?? undefined,
    cowork_thread_id: row.cowork_thread_id ?? undefined,
    campaign_id: row.campaign_id ?? undefined,
    mode: row.mode,
    review_token,
    review_url: row.review_url ?? undefined,
    error: row.error ?? undefined,
    created_at: iso(row.created_at)!,
    updated_at: iso(row.updated_at)!,
    companies: row.companies_json ?? [],
  };
}

function toBatchRun(row: any): BatchRun {
  return { batch_id: row.batch_id, run_id: row.run_id, company_name: row.company_name, domain: row.domain ?? undefined, status: row.status, error: row.error ?? undefined, created_at: iso(row.created_at)!, updated_at: iso(row.updated_at)! };
}

export async function createBatch(input: CreateBatchInput): Promise<Batch & { companies: Array<{ company_name: string; domain?: string; contacts?: any[] }> }> {
  const parsed = createBatchSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid batch payload: ${parsed.error.message}`);
  const data = parsed.data;
  const token = reviewToken();
  const timestamp = now();
  const reviewUrl = reviewUrlForBatchTokenLocal(token);
  const result = await query(
    `insert into batches (id, source, status, requested_by, cowork_thread_id, campaign_id, mode, review_token_hash, review_url, companies_json, created_at, updated_at)
     values ($1,$2,'queued',$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$10) returning *`,
    [id('batch'), data.source, data.requested_by ?? null, data.cowork_thread_id ?? null, data.campaign_id ?? null, data.mode, tokenHash(token), reviewUrl, JSON.stringify(data.companies), timestamp],
  );
  return clone(toBatch(result.rows[0], token));
}

export async function getBatchById(batchId: string) {
  const result = await query('select * from batches where id=$1', [batchId]);
  return result.rows[0] ? clone(toBatch(result.rows[0])) : null;
}

export async function listBatchRuns(batchId: string): Promise<BatchRun[]> {
  const result = await query('select * from batch_runs where batch_id=$1 order by created_at asc', [batchId]);
  return result.rows.map(toBatchRun);
}

export async function attachRunToBatch(batchId: string, runId: string, company: { company_name: string; domain?: string }, status: BatchRun['status'] = 'queued') {
  await query(
    `insert into batch_runs (batch_id, run_id, company_name, domain, status, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$6) on conflict (batch_id, run_id) do update set status=excluded.status, updated_at=excluded.updated_at`,
    [batchId, runId, company.company_name, company.domain ?? null, status, now()],
  );
}

export async function updateBatchStatus(batchId: string, status: Batch['status'], error?: string) {
  await query('update batches set status=$2, error=$3, updated_at=$4 where id=$1', [batchId, status, error ?? null, now()]);
}

export async function updateBatchRunStatus(batchId: string, runId: string, status: BatchRun['status'], error?: string) {
  await query('update batch_runs set status=$3, error=$4, updated_at=$5 where batch_id=$1 and run_id=$2', [batchId, runId, status, error ?? null, now()]);
}

export async function saveResearchArtifact(runId: string, artifact: Partial<ResearchArtifact> & { company_name: string }) {
  await query(
    `insert into research_artifacts (id, run_id, company_name, domain, core_hypothesis, evidence_ledger, source_urls, raw_summary, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$9)`,
    [id('artifact'), runId, artifact.company_name, artifact.domain ?? null, artifact.core_hypothesis ?? null, JSON.stringify(artifact.evidence_ledger ?? []), JSON.stringify(artifact.source_urls ?? []), JSON.stringify(artifact.raw_summary ?? {}), now()],
  );
}

export async function getBatchReviewByToken(token: string): Promise<BatchReviewState> {
  const result = await query('select * from batches where review_token_hash=$1', [tokenHash(token)]);
  if (!result.rows[0]) throw new Error('Batch review token not found');
  const batch = toBatch(result.rows[0], token);
  const batchRuns = await listBatchRuns(batch.id);
  const runs = [];
  for (const br of batchRuns) {
    const runResult = await query('select * from runs where id=$1', [br.run_id]);
    if (!runResult.rows[0]) continue;
    const runTokenless = toRun(runResult.rows[0]);
    const contacts = await contactsForRun(br.run_id);
    const reviewContacts = await Promise.all(contacts.map(async (contact) => ({ ...contact, emails: await emailsForContact(contact.id) })));
    runs.push({ ...br, review: { run: runTokenless, contacts: reviewContacts } });
  }
  return clone({ batch, runs });
}

export async function saveBatchReviewState(token: string, input: SaveBatchReviewInput, actor = 'anonymous') {
  const parsed = saveBatchReviewSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid batch review payload: ${parsed.error.message}`);
  const state = await getBatchReviewByToken(token);
  for (const runInput of parsed.data.runs) {
    const item = state.runs.find((r) => r.run_id === runInput.run_id);
    if (!item) throw new Error(`Run ${runInput.run_id} does not belong to batch`);
    // Save directly without needing original single-run token.
    await transaction(async (client) => {
      for (const incoming of runInput.contacts) {
        const contactUpdate = await client.query(`update contacts set status=$2, primary_angle=$3, opening_hook=$4, proof_used=$5, guardrail=$6, evidence_json=$7::jsonb, qa_warnings_json=$8::jsonb, updated_at=$9 where id=$1 and run_id=$10`, [incoming.id, incoming.status, incoming.primary_angle ?? null, incoming.opening_hook ?? null, incoming.proof_used ?? null, incoming.guardrail ?? null, JSON.stringify(incoming.evidence_urls ?? []), JSON.stringify(incoming.qa_warnings ?? []), now(), runInput.run_id]);
        if (contactUpdate.rowCount !== 1) throw new Error(`Contact ${incoming.id} does not belong to batch run ${runInput.run_id}`);
        for (const email of incoming.emails) {
          const emailUpdate = await client.query(`update sequence_emails set subject=$3, body_html=$4, body_text=$5, edited_by=$6, edited_at=$7, updated_at=$7 where contact_id=$1 and step_number=$2`, [incoming.id, email.step_number, email.subject, email.body_html, email.body_text ?? stripHtml(email.body_html), actor, now()]);
          if (emailUpdate.rowCount !== 1) throw new Error(`Email step ${email.step_number} not found for contact ${incoming.id}`);
        }
      }
    });
  }
  return { ok: true as const, saved_at: now() };
}

export async function submitBatchReview(token: string, actor = 'anonymous') {
  const state = await getBatchReviewByToken(token);
  let approved = 0;
  const push_job_ids: string[] = [];
  for (const item of state.runs) {
    const good = item.review.contacts.filter((c) => c.status === 'approved' && c.email && !c.email.endsWith('.invalid'));
    approved += good.length;
    if (good.length) {
      await query(`update runs set status='review_submitted', updated_at=$2 where id=$1`, [item.run_id, now()]);
      const jobId = id('push');
      await query(`insert into push_jobs (id, run_id, status, instantly_campaign_id, idempotency_key, attempts, created_at, updated_at) values ($1,$2,'queued',$3,$4,0,$5,$5) on conflict (idempotency_key) do nothing`, [jobId, item.run_id, item.review.run.campaign_id ?? null, `push:${item.run_id}`, now()]);
      push_job_ids.push(jobId);
    }
  }
  if (approved === 0) throw new Error('At least one approved contact with a real email is required before submit');
  await updateBatchStatus(state.batch.id, 'review_submitted');
  return { ok: true as const, batch_id: state.batch.id, approved_contacts: approved, push_job_ids, status: 'review_submitted', message: 'Approved contacts are queued for server-side Instantly push.' };
}

export async function recordCoworkMessage(input: Omit<CoworkMessage, 'id' | 'created_at'>) {
  const result = await query(`insert into cowork_messages (id, batch_id, thread_id, direction, status, payload, response, error, created_at) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9) returning *`, [id('cowork_msg'), input.batch_id, input.thread_id ?? null, input.direction, input.status, JSON.stringify(input.payload ?? {}), input.response ? JSON.stringify(input.response) : null, input.error ?? null, now()]);
  const row = result.rows[0];
  return clone({ id: row.id, batch_id: row.batch_id, thread_id: row.thread_id ?? undefined, direction: row.direction, status: row.status, payload: row.payload, response: row.response, error: row.error ?? undefined, created_at: iso(row.created_at)! });
}

export function reviewUrlForBatchToken(token: string) { return reviewUrlForBatchTokenLocal(token); }

export async function pushApprovedContactsForBatch(batchId: string, pusher: InstantlyPusher) {
  const batch = await getBatchById(batchId);
  if (!batch) throw new Error(`Batch not found: ${batchId}`);
  if (batch.status !== 'review_submitted' && batch.status !== 'pushing' && batch.status !== 'partially_failed') throw new Error('Batch must be review_submitted before push');
  await updateBatchStatus(batchId, 'pushing');
  let pushed = 0;
  let failed = 0;
  for (const br of await listBatchRuns(batchId)) {
    const result = await pushApprovedContacts(br.run_id, pusher);
    pushed += result.pushed;
    failed += result.failed;
  }
  await updateBatchStatus(batchId, failed ? 'partially_failed' : 'pushed');
  return { ok: true as const, pushed, failed, campaign_paused: true };
}
