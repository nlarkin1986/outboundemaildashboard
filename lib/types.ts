export type RunStatus = 'queued' | 'researching' | 'writing' | 'ready_for_review' | 'review_submitted' | 'pushing' | 'pushed' | 'partially_failed' | 'failed';
export type ContactStatus = 'needs_edit' | 'approved' | 'skipped';

export type Run = {
  id: string;
  company_name: string;
  domain?: string;
  status: RunStatus;
  mode: 'fast' | 'deep';
  source: 'cowork' | 'manual' | 'api';
  campaign_id?: string;
  cowork_thread_id?: string;
  review_token: string;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  run_id: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  company?: string;
  email: string;
  domain?: string;
  status: ContactStatus;
  primary_angle?: string;
  opening_hook?: string;
  proof_used?: string;
  guardrail?: string;
  evidence_urls: string[];
  qa_warnings: string[];
};

export type SequenceEmail = {
  id: string;
  contact_id: string;
  step_number: 1 | 2 | 3;
  subject: string;
  body_html: string;
  body_text: string;
  original_subject: string;
  original_body_html: string;
  edited_by?: string;
  edited_at?: string;
};

export type ReviewContact = Contact & { emails: SequenceEmail[] };
export type ReviewState = { run: Run; contacts: ReviewContact[] };

export type ReviewEvent = {
  id: string;
  run_id: string;
  contact_id?: string;
  actor?: string;
  event_type: string;
  before_json?: unknown;
  after_json?: unknown;
  created_at: string;
};

export type PushJob = {
  id: string;
  run_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  instantly_campaign_id?: string;
  idempotency_key: string;
  attempts: number;
  result_json?: unknown;
  error_message?: string;
  created_at: string;
  updated_at: string;
};

export type InstantlyPushPayload = {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  campaign_id?: string;
  emails: SequenceEmail[];
  idempotency_key: string;
};
