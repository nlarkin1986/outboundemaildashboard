import crypto from 'node:crypto';
import { createBatchSchema, createRunSchema, saveBatchReviewSchema, saveReviewSchema, type CreateBatchInput, type CreateRunInput, type SaveBatchReviewInput, type SaveReviewInput } from './schemas';
import type { Batch, BatchReviewState, BatchRun, Contact, CoworkMessage, InstantlyPushPayload, PushJob, ResearchArtifact, ReviewContact, ReviewEvent, ReviewState, Run, SequenceEmail, Account, AppUser, CoworkActor } from './types';

type Db = {
  accounts: Map<string, Account>;
  users: Map<string, AppUser>;
  runs: Map<string, Run>;
  contacts: Map<string, Contact>;
  emails: Map<string, SequenceEmail>;
  events: ReviewEvent[];
  pushJobs: Map<string, PushJob>;
  pushedContacts: Set<string>;
  batches: Map<string, Batch & { companies: Array<{ company_name: string; domain?: string; contacts?: any[] }> }>;
  batchRuns: Map<string, BatchRun>;
  researchArtifacts: Map<string, ResearchArtifact>;
  coworkMessages: Map<string, CoworkMessage>;
};

const globalForStore = globalThis as unknown as { __outboundStore?: Db };

function newDb(): Db {
  return { accounts: new Map(), users: new Map(), runs: new Map(), contacts: new Map(), emails: new Map(), events: [], pushJobs: new Map(), pushedContacts: new Set(), batches: new Map(), batchRuns: new Map(), researchArtifacts: new Map(), coworkMessages: new Map() };
}

const db = globalForStore.__outboundStore ?? newDb();
globalForStore.__outboundStore = db;

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const reviewToken = () => crypto.randomBytes(32).toString('hex');

export function resetStore() {
  db.accounts.clear();
  db.users.clear();
  db.runs.clear();
  db.contacts.clear();
  db.emails.clear();
  db.events.length = 0;
  db.pushJobs.clear();
  db.pushedContacts.clear();
  db.batches.clear();
  db.batchRuns.clear();
  db.researchArtifacts.clear();
  db.coworkMessages.clear();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function getRunOrThrow(runId: string) {
  const run = db.runs.get(runId);
  if (!run) throw new Error(`Run not found: ${runId}`);
  return run;
}

function normalizeActorEmail(email?: string) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('A valid actor email is required');
  return normalized;
}

function accountDomainFromEmail(email: string) {
  return email.split('@')[1];
}

export async function upsertUserFromCoworkActor(actor: CoworkActor): Promise<{ account: Account; user: AppUser }> {
  const email = normalizeActorEmail(actor.email);
  const domain = accountDomainFromEmail(email);
  const timestamp = now();
  let account = [...db.accounts.values()].find((candidate) => candidate.domain === domain || (actor.cowork_org_id && candidate.cowork_org_id === actor.cowork_org_id));
  if (!account) {
    account = { id: id('account'), name: domain, domain, cowork_org_id: actor.cowork_org_id, created_at: timestamp, updated_at: timestamp };
    db.accounts.set(account.id, account);
  } else {
    account.updated_at = timestamp;
    if (actor.cowork_org_id && !account.cowork_org_id) account.cowork_org_id = actor.cowork_org_id;
  }
  let user = [...db.users.values()].find((candidate) => candidate.email === email);
  if (!user) {
    user = { id: id('user'), account_id: account.id, email, name: actor.name, cowork_user_id: actor.cowork_user_id, role: 'member', last_seen_at: timestamp, created_at: timestamp, updated_at: timestamp };
    db.users.set(user.id, user);
  } else {
    user.account_id = account.id;
    user.name = actor.name ?? user.name;
    user.cowork_user_id = actor.cowork_user_id ?? user.cowork_user_id;
    user.last_seen_at = timestamp;
    user.updated_at = timestamp;
  }
  return clone({ account, user });
}

function contactsForRun(runId: string): Contact[] {
  return [...db.contacts.values()].filter((c) => c.run_id === runId).sort((a, b) => a.email.localeCompare(b.email));
}

function emailsForContact(contactId: string): SequenceEmail[] {
  return [...db.emails.values()].filter((e) => e.contact_id === contactId).sort((a, b) => a.step_number - b.step_number);
}

export async function createRun(input: CreateRunInput): Promise<Run & { contacts: Contact[] }> {
  const parsed = createRunSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid run payload: ${parsed.error.message}`);
  const data = parsed.data;
  const runId = id('run');
  const timestamp = now();
  const run: Run = {
    id: runId,
    company_name: data.company_name,
    domain: data.domain,
    status: 'queued',
    mode: data.mode,
    source: data.source,
    account_id: data.account_id,
    created_by_user_id: data.created_by_user_id,
    created_by: data.created_by,
    campaign_id: data.campaign_id,
    cowork_thread_id: data.cowork_thread_id,
    review_token: reviewToken(),
    created_at: timestamp,
    updated_at: timestamp,
  };
  db.runs.set(run.id, run);

  const seen = new Set<string>();
  const contacts: Contact[] = [];
  for (const contact of data.contacts) {
    if (seen.has(contact.email)) continue;
    seen.add(contact.email);
    const row: Contact = {
      id: id('contact'),
      run_id: run.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      title: contact.title,
      company: contact.company ?? data.company_name,
      email: contact.email,
      domain: contact.domain ?? data.domain,
      status: 'needs_edit',
      evidence_urls: [],
      qa_warnings: [],
    };
    db.contacts.set(row.id, row);
    contacts.push(row);
  }
  db.events.push({ id: id('event'), run_id: run.id, event_type: 'run_created', after_json: { contact_count: contacts.length }, created_at: timestamp });
  return clone({ ...run, contacts });
}

export async function listRuns(): Promise<Array<Run & { contact_count: number; approved_count: number }>> {
  return [...db.runs.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((run) => {
    const contacts = contactsForRun(run.id);
    return clone({ ...run, contact_count: contacts.length, approved_count: contacts.filter((c) => c.status === 'approved').length });
  });
}

export async function getRun(runId: string): Promise<(Run & { contacts: ReviewContact[] }) | null> {
  const run = db.runs.get(runId);
  if (!run) return null;
  return clone({ ...run, contacts: contactsForRun(run.id).map((c) => ({ ...c, emails: emailsForContact(c.id) })) });
}

export async function generateDraftForRun(runId: string): Promise<ReviewState> {
  const run = getRunOrThrow(runId);
  run.status = 'writing';
  run.updated_at = now();
  const contacts = contactsForRun(run.id);
  for (const contact of contacts) {
    const first = contact.first_name || 'there';
    contact.primary_angle = contact.primary_angle ?? 'urgent handoffs where the next person needs the full customer story';
    contact.opening_hook = contact.opening_hook ?? `When ${run.company_name} customers move across channels, the next person should not make them repeat the issue.`;
    contact.proof_used = contact.proof_used ?? 'KUHL: 44% reduction in WISMO emails; 79% email resolution rate';
    contact.guardrail = contact.guardrail ?? 'Personalization should use public evidence and clearly label inference; no unsupported internal claims.';
    contact.evidence_urls = contact.evidence_urls.length ? contact.evidence_urls : [`https://${run.domain ?? contact.domain ?? 'example.com'}`];
    contact.qa_warnings = contact.qa_warnings ?? [];
    if (emailsForContact(contact.id).length === 0) {
      const drafts = [
        ['event-date handoffs', `<p>Hi ${first},</p><p>When a customer issue becomes urgent, the handoff cannot feel like a reset.</p><p>Gladly helps teams give agents the full customer story across channels, so customers do not have to repeat themselves.</p>`],
        ['handoffs that do not reset', `<p>Hi ${first},</p><p>The operational risk is not just response time. It is whether the next teammate can see the prior conversation, order details, and urgency right away.</p><p>Worth comparing notes on where that shows up for ${run.company_name}?</p>`],
        ['before it becomes urgent', `<p>Hi ${first},</p><p>Last note from me. Gladly is built around the customer rather than the ticket, which helps teams route and resolve urgent conversations with the right history attached.</p><p>Open to a quick look?</p>`],
      ] as const;
      drafts.forEach(([subject, body], index) => {
        const email: SequenceEmail = { id: id('email'), contact_id: contact.id, step_number: (index + 1) as 1 | 2 | 3, subject, body_html: body, body_text: body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), original_subject: subject, original_body_html: body };
        db.emails.set(email.id, email);
      });
    }
  }
  run.status = 'ready_for_review';
  run.updated_at = now();
  db.events.push({ id: id('event'), run_id: run.id, event_type: 'draft_generated', after_json: { contact_count: contacts.length }, created_at: now() });
  return getReviewStateByToken(run.review_token);
}

export async function getReviewStateByToken(token: string): Promise<ReviewState> {
  const run = [...db.runs.values()].find((r) => r.review_token === token);
  if (!run) throw new Error('Review token not found');
  const contacts = contactsForRun(run.id).map((contact) => ({ ...contact, emails: emailsForContact(contact.id) }));
  return clone({ run, contacts });
}

export async function saveReviewState(token: string, input: SaveReviewInput, actor = 'anonymous'): Promise<{ ok: true; saved_at: string }> {
  const parsed = saveReviewSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid review payload: ${parsed.error.message}`);
  const state = await getReviewStateByToken(token);
  const timestamp = now();
  for (const incoming of parsed.data.contacts) {
    const existing = db.contacts.get(incoming.id);
    if (!existing || existing.run_id !== state.run.id) throw new Error(`Contact not found for review token: ${incoming.id}`);
    const before = clone({ ...existing, emails: emailsForContact(existing.id) });
    existing.status = incoming.status;
    existing.primary_angle = incoming.primary_angle;
    existing.opening_hook = incoming.opening_hook;
    existing.proof_used = incoming.proof_used;
    existing.guardrail = incoming.guardrail;
    existing.evidence_urls = incoming.evidence_urls ?? existing.evidence_urls;
    existing.qa_warnings = incoming.qa_warnings ?? existing.qa_warnings;
    for (const email of incoming.emails) {
      const row = emailsForContact(existing.id).find((e) => e.step_number === email.step_number);
      if (!row) throw new Error(`Email step ${email.step_number} not found for ${existing.email}`);
      row.subject = email.subject;
      row.body_html = email.body_html;
      row.body_text = email.body_text ?? email.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      row.edited_by = actor;
      row.edited_at = timestamp;
    }
    db.events.push({ id: id('event'), run_id: state.run.id, contact_id: existing.id, actor, event_type: 'review_saved', before_json: before, after_json: clone({ ...existing, emails: emailsForContact(existing.id) }), created_at: timestamp });
  }
  const run = getRunOrThrow(state.run.id);
  run.updated_at = timestamp;
  return { ok: true, saved_at: timestamp };
}

export async function submitApproved(token: string, actor = 'anonymous'): Promise<{ ok: true; approved_count: number; push_job_id: string; status: string }> {
  const state = await getReviewStateByToken(token);
  const approved = state.contacts.filter((c) => c.status === 'approved');
  if (approved.length === 0) throw new Error('At least one approved contact is required before submit');
  const timestamp = now();
  const run = getRunOrThrow(state.run.id);
  const idempotencyKey = `push:${run.id}`;
  const existingJob = [...db.pushJobs.values()].find((job) => job.idempotency_key === idempotencyKey);
  if (existingJob) {
    return { ok: true, approved_count: approved.length, push_job_id: existingJob.id, status: 'queued_for_push' };
  }
  run.status = 'review_submitted';
  run.updated_at = timestamp;
  const job: PushJob = { id: id('push'), run_id: run.id, status: 'queued', instantly_campaign_id: run.campaign_id, idempotency_key: idempotencyKey, attempts: 0, created_at: timestamp, updated_at: timestamp };
  db.pushJobs.set(job.id, job);
  db.events.push({ id: id('event'), run_id: run.id, actor, event_type: 'review_submitted', after_json: { approved_count: approved.length, push_job_id: job.id }, created_at: timestamp });
  return { ok: true, approved_count: approved.length, push_job_id: job.id, status: 'queued_for_push' };
}

export type InstantlyPusher = (payload: InstantlyPushPayload) => Promise<{ instantly_lead_id?: string; campaign_paused: boolean; raw?: unknown }>;

export async function pushApprovedContacts(runId: string, pusher: InstantlyPusher): Promise<{ ok: true; pushed: number; failed: number; campaign_paused: boolean }> {
  const run = getRunOrThrow(runId);
  if (run.status === 'pushed') return { ok: true, pushed: 0, failed: 0, campaign_paused: true };
  if (run.status !== 'review_submitted' && run.status !== 'pushing' && run.status !== 'partially_failed') throw new Error('Run must be review_submitted before push');
  run.status = 'pushing';
  run.updated_at = now();
  let pushed = 0;
  let failed = 0;
  for (const contact of contactsForRun(run.id).filter((c) => c.status === 'approved' && c.email && !c.email.endsWith('.invalid'))) {
    const key = `${run.id}:${contact.id}`;
    if (db.pushedContacts.has(key)) continue;
    db.pushedContacts.add(key);
    try {
      const result = await pusher({ email: contact.email, first_name: contact.first_name, last_name: contact.last_name, company: contact.company, title: contact.title, campaign_id: run.campaign_id, emails: emailsForContact(contact.id), idempotency_key: key });
      if (!result.campaign_paused) throw new Error('Instantly campaign was not confirmed paused');
      pushed += 1;
      db.events.push({ id: id('event'), run_id: run.id, contact_id: contact.id, event_type: 'contact_pushed', after_json: result, created_at: now() });
    } catch (error) {
      db.pushedContacts.delete(key);
      failed += 1;
      db.events.push({ id: id('event'), run_id: run.id, contact_id: contact.id, event_type: 'contact_push_failed', after_json: { error: error instanceof Error ? error.message : String(error) }, created_at: now() });
    }
  }
  run.status = failed ? 'partially_failed' : 'pushed';
  run.updated_at = now();
  return { ok: true, pushed, failed, campaign_paused: true };
}

export function reviewUrlForRun(run: Run) {
  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';
  return `${base}/review/${run.review_token}`;
}


function tokenForBatch() { return reviewToken(); }

export async function createBatch(input: CreateBatchInput): Promise<Batch & { companies: Array<{ company_name: string; domain?: string; contacts?: any[] }> }> {
  const parsed = createBatchSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid batch payload: ${parsed.error.message}`);
  const data = parsed.data;
  const actor = data.actor ?? [data.user_email, data.requested_by_email, data.actor_email, data.created_by_email, data.requested_by]
    .map((email) => {
      try { return email ? { email: normalizeActorEmail(email) } : null; } catch { return null; }
    })
    .find(Boolean) ?? undefined;
  const owner = actor ? await upsertUserFromCoworkActor(actor) : null;
  const ownerEmail = owner?.user.email ?? data.requested_by ?? data.requested_by_email ?? data.user_email ?? data.actor_email ?? data.created_by_email;
  const timestamp = now();
  const token = tokenForBatch();
  const batch: Batch & { companies: Array<{ company_name: string; domain?: string; contacts?: any[] }> } = {
    id: id('batch'),
    source: data.source,
    status: 'queued',
    requested_by: ownerEmail,
    account_id: owner?.account.id,
    created_by_user_id: owner?.user.id,
    cowork_thread_id: data.cowork_thread_id,
    campaign_id: data.campaign_id,
    mode: data.mode,
    review_token: token,
    review_url: reviewUrlForBatchToken(token),
    created_at: timestamp,
    updated_at: timestamp,
    companies: data.companies,
  };
  db.batches.set(batch.id, batch);
  return clone(batch);
}

export async function getBatchById(batchId: string): Promise<(Batch & { companies: Array<{ company_name: string; domain?: string; contacts?: any[] }> }) | null> {
  const batch = db.batches.get(batchId);
  return batch ? clone(batch) : null;
}

export async function listBatchRuns(batchId: string): Promise<BatchRun[]> {
  return clone([...db.batchRuns.values()].filter((r) => r.batch_id === batchId).sort((a, b) => a.created_at.localeCompare(b.created_at)));
}

export async function attachRunToBatch(batchId: string, runId: string, company: { company_name: string; domain?: string }, status: BatchRun['status'] = 'queued') {
  const timestamp = now();
  db.batchRuns.set(`${batchId}:${runId}`, { batch_id: batchId, run_id: runId, company_name: company.company_name, domain: company.domain, status, created_at: timestamp, updated_at: timestamp });
}

export async function updateBatchStatus(batchId: string, status: Batch['status'], error?: string) {
  const batch = db.batches.get(batchId);
  if (!batch) throw new Error(`Batch not found: ${batchId}`);
  batch.status = status;
  batch.error = error;
  batch.updated_at = now();
}

export async function updateBatchRunStatus(batchId: string, runId: string, status: BatchRun['status'], error?: string) {
  const row = db.batchRuns.get(`${batchId}:${runId}`);
  if (!row) throw new Error(`Batch run not found: ${batchId}/${runId}`);
  row.status = status;
  row.error = error;
  row.updated_at = now();
}

export async function saveResearchArtifact(runId: string, artifact: Partial<ResearchArtifact> & { company_name: string }) {
  const timestamp = now();
  const row: ResearchArtifact = {
    id: id('artifact'),
    run_id: runId,
    company_name: artifact.company_name,
    domain: artifact.domain,
    core_hypothesis: artifact.core_hypothesis,
    evidence_ledger: artifact.evidence_ledger ?? [],
    source_urls: artifact.source_urls ?? [],
    raw_summary: artifact.raw_summary ?? {},
    created_at: timestamp,
    updated_at: timestamp,
  };
  db.researchArtifacts.set(row.id, row);
}

export async function getBatchReviewByToken(token: string): Promise<BatchReviewState> {
  const batch = [...db.batches.values()].find((b) => b.review_token === token);
  if (!batch) throw new Error('Batch review token not found');
  const runs = [];
  for (const br of await listBatchRuns(batch.id)) {
    const run = db.runs.get(br.run_id);
    if (!run) continue;
    runs.push({ ...br, review: await getReviewStateByToken(run.review_token) });
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
    await saveReviewState(item.review.run.review_token, { contacts: runInput.contacts }, actor);
  }
  return { ok: true as const, saved_at: now() };
}

export async function submitBatchReview(token: string, actor = 'anonymous') {
  const state = await getBatchReviewByToken(token);
  let approved = 0;
  const push_job_ids: string[] = [];
  for (const item of state.runs) {
    const approvedContacts = item.review.contacts.filter((c) => c.status === 'approved' && c.email && !c.email.endsWith('.invalid'));
    approved += approvedContacts.length;
    if (approvedContacts.length) {
      const result = await submitApproved(item.review.run.review_token, actor);
      push_job_ids.push(result.push_job_id);
    }
  }
  if (approved === 0) throw new Error('At least one approved contact with a real email is required before submit');
  await updateBatchStatus(state.batch.id, 'review_submitted');
  return { ok: true as const, batch_id: state.batch.id, approved_contacts: approved, push_job_ids, status: 'review_submitted', message: 'Approved contacts are queued for server-side Instantly push.' };
}

export async function recordCoworkMessage(input: Omit<CoworkMessage, 'id' | 'created_at'>) {
  const row: CoworkMessage = { ...input, id: id('cowork_msg'), created_at: now() };
  db.coworkMessages.set(row.id, row);
  return clone(row);
}

export function reviewUrlForBatchToken(token: string) {
  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';
  return `${base}/review/batch/${token}`;
}

export async function pushApprovedContactsForBatch(batchId: string, pusher: InstantlyPusher) {
  const batch = db.batches.get(batchId);
  if (!batch) throw new Error(`Batch not found: ${batchId}`);
  if (batch.status !== 'review_submitted' && batch.status !== 'pushing' && batch.status !== 'partially_failed') throw new Error('Batch must be review_submitted before push');
  batch.status = 'pushing';
  let pushed = 0;
  let failed = 0;
  for (const br of await listBatchRuns(batchId)) {
    const result = await pushApprovedContacts(br.run_id, pusher);
    pushed += result.pushed;
    failed += result.failed;
  }
  batch.status = failed ? 'partially_failed' : 'pushed';
  batch.updated_at = now();
  return { ok: true as const, pushed, failed, campaign_paused: true };
}
