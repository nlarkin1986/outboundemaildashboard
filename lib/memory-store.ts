import crypto from 'node:crypto';
import { createRunSchema, saveReviewSchema, type CreateRunInput, type SaveReviewInput } from './schemas';
import type { Contact, InstantlyPushPayload, PushJob, ReviewContact, ReviewEvent, ReviewState, Run, SequenceEmail } from './types';

type Db = {
  runs: Map<string, Run>;
  contacts: Map<string, Contact>;
  emails: Map<string, SequenceEmail>;
  events: ReviewEvent[];
  pushJobs: Map<string, PushJob>;
  pushedContacts: Set<string>;
};

const globalForStore = globalThis as unknown as { __outboundStore?: Db };

function newDb(): Db {
  return { runs: new Map(), contacts: new Map(), emails: new Map(), events: [], pushJobs: new Map(), pushedContacts: new Set() };
}

const db = globalForStore.__outboundStore ?? newDb();
globalForStore.__outboundStore = db;

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const reviewToken = () => crypto.randomBytes(32).toString('hex');

export function resetStore() {
  db.runs.clear();
  db.contacts.clear();
  db.emails.clear();
  db.events.length = 0;
  db.pushJobs.clear();
  db.pushedContacts.clear();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function getRunOrThrow(runId: string) {
  const run = db.runs.get(runId);
  if (!run) throw new Error(`Run not found: ${runId}`);
  return run;
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
  run.status = 'review_submitted';
  run.updated_at = timestamp;
  const job: PushJob = { id: id('push'), run_id: run.id, status: 'queued', instantly_campaign_id: run.campaign_id, idempotency_key: `push:${run.id}`, attempts: 0, created_at: timestamp, updated_at: timestamp };
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
  for (const contact of contactsForRun(run.id).filter((c) => c.status === 'approved')) {
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
