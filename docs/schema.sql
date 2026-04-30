-- Production Postgres schema for the Cowork -> Vercel -> Instantly approval workflow.
-- Safe to run repeatedly in a fresh or existing database.

create table if not exists accounts (
  id text primary key,
  name text,
  domain text not null unique,
  cowork_org_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  email text not null unique,
  name text,
  cowork_user_id text unique,
  role text not null default 'member',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists runs (
  id text primary key,
  company_name text not null,
  domain text,
  status text not null check (status in ('queued','researching','writing','ready_for_review','review_submitted','pushing','pushed','partially_failed','failed')),
  mode text not null default 'fast' check (mode in ('fast','deep')),
  source text not null check (source in ('cowork','manual','api')),
  play_id text,
  play_metadata_json jsonb not null default '{}',
  created_by text,
  account_id text references accounts(id),
  created_by_user_id text references users(id),
  cowork_thread_id text,
  cowork_callback_url text,
  review_token_hash text unique,
  campaign_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contacts (
  id text primary key,
  run_id text not null references runs(id) on delete cascade,
  first_name text,
  last_name text,
  title text,
  company text,
  email text not null,
  domain text,
  status text not null default 'needs_edit' check (status in ('needs_edit','approved','skipped')),
  primary_angle text,
  opening_hook text,
  proof_used text,
  guardrail text,
  sequence_code text,
  play_metadata_json jsonb not null default '{}',
  evidence_json jsonb not null default '[]',
  qa_warnings_json jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, email)
);

create table if not exists sequence_emails (
  id text primary key,
  contact_id text not null references contacts(id) on delete cascade,
  step_number int not null check (step_number in (1,2,3)),
  original_step_number int,
  step_label text,
  subject text not null,
  body_html text not null,
  body_text text,
  original_subject text,
  original_body_html text,
  edited_by text,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contact_id, step_number)
);

create table if not exists review_events (
  id text primary key,
  run_id text not null references runs(id) on delete cascade,
  contact_id text references contacts(id) on delete set null,
  actor text,
  event_type text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists push_jobs (
  id text primary key,
  run_id text not null references runs(id) on delete cascade,
  status text not null check (status in ('queued','running','completed','failed')),
  instantly_campaign_id text,
  idempotency_key text not null unique,
  attempts int not null default 0,
  result_json jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pushed_contacts (
  id text primary key,
  run_id text not null references runs(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  instantly_lead_id text,
  instantly_campaign_id text,
  status text not null check (status in ('running','completed','failed')),
  response_json jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  unique(run_id, contact_id)
);

alter table runs add column if not exists account_id text references accounts(id);
alter table runs add column if not exists created_by_user_id text references users(id);
alter table runs add column if not exists play_id text;
alter table runs add column if not exists play_metadata_json jsonb not null default '{}';
alter table contacts add column if not exists sequence_code text;
alter table contacts add column if not exists play_metadata_json jsonb not null default '{}';
alter table sequence_emails add column if not exists original_step_number int;
alter table sequence_emails add column if not exists step_label text;
alter table sequence_emails drop constraint if exists sequence_emails_step_number_check;
alter table sequence_emails add constraint sequence_emails_step_number_check check (step_number > 0);

create index if not exists idx_contacts_run_id on contacts(run_id);
create index if not exists idx_users_email on users(email);
create index if not exists idx_users_account_id on users(account_id);
create index if not exists idx_runs_account_id on runs(account_id);
create index if not exists idx_runs_created_by_user_id on runs(created_by_user_id);
create index if not exists idx_sequence_emails_contact_id on sequence_emails(contact_id);
create index if not exists idx_review_events_run_id on review_events(run_id);
create index if not exists idx_push_jobs_run_id on push_jobs(run_id);
create index if not exists idx_pushed_contacts_run_id on pushed_contacts(run_id);

create table if not exists batches (
  id text primary key,
  source text not null default 'cowork',
  status text not null check (status in ('queued','processing','ready_for_review','review_submitted','pushing','pushed','partially_failed','failed')),
  play_id text,
  play_metadata_json jsonb not null default '{}',
  requested_by text,
  account_id text references accounts(id),
  created_by_user_id text references users(id),
  cowork_thread_id text,
  campaign_id text,
  mode text not null default 'fast' check (mode in ('fast','deep')),
  review_token_hash text unique,
  review_url text,
  companies_json jsonb not null default '[]',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table batches add column if not exists account_id text references accounts(id);
alter table batches add column if not exists created_by_user_id text references users(id);
alter table batches add column if not exists play_id text;
alter table batches add column if not exists play_metadata_json jsonb not null default '{}';

create table if not exists batch_runs (
  batch_id text not null references batches(id) on delete cascade,
  run_id text not null references runs(id) on delete cascade,
  company_key text,
  company_name text not null,
  domain text,
  status text not null check (status in ('queued','researching','writing','ready_for_review','failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (batch_id, run_id)
);

alter table batch_runs add column if not exists company_key text;

create table if not exists research_artifacts (
  id text primary key,
  run_id text not null references runs(id) on delete cascade,
  company_name text not null,
  domain text,
  core_hypothesis text,
  evidence_ledger jsonb not null default '[]',
  source_urls jsonb not null default '[]',
  raw_summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cowork_messages (
  id text primary key,
  batch_id text not null references batches(id) on delete cascade,
  thread_id text,
  direction text not null,
  status text not null,
  payload jsonb not null default '{}',
  response jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_batch_runs_batch_id on batch_runs(batch_id);
create unique index if not exists idx_batch_runs_batch_company_key on batch_runs(batch_id, company_key) where company_key is not null;
create index if not exists idx_batches_account_id on batches(account_id);
create index if not exists idx_batches_created_by_user_id on batches(created_by_user_id);
create index if not exists idx_batch_runs_run_id on batch_runs(run_id);
create index if not exists idx_research_artifacts_run_id on research_artifacts(run_id);
create index if not exists idx_cowork_messages_batch_id on cowork_messages(batch_id);
