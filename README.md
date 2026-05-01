# Outbound Approval Vercel App

Production-oriented MVP for the Cowork → Vercel → review approval → server-side Instantly push workflow.

## What is implemented

- Next.js App Router app on Vercel-compatible structure.
- Run creation API: `POST /api/runs`.
- Durable Postgres-backed store when `DATABASE_URL` is configured.
- Local in-memory fallback when `DATABASE_URL` is not configured, for fast development/tests only. Vercel refuses to use the fallback and requires `DATABASE_URL`.
- Review page: `/review/:token` with Gladly-style UI.
- Save endpoint: `POST /api/review/:token/save`.
- Submit endpoint: `POST /api/review/:token/submit`.
- Internal push endpoint: `POST /api/internal/push/:runId`.
- Batch Cowork webhook: `POST /api/webhooks/cowork/batch`.
- Batch review dashboard: `/review/batch/:token`.
- Batch save/submit endpoints: `POST /api/review/batch/:token/save` and `POST /api/review/batch/:token/submit`.
- Internal batch process/push endpoints: `POST /api/internal/process-batch/:batchId` and `POST /api/internal/push-batch/:batchId`.
- Instantly client seam that keeps API keys server-side.
- AI SDK/Claude generation seam and structured output schema.
- Batch agent seam that persists evidence ledgers, guardrails, and agent-generated drafts into the review dashboard.
- Exa and Browserbase server-side research seams.
- Cowork webhook/postback client with noop behavior until Cowork API env is configured.
- Vercel config with function duration hints.
- Tests for run validation, review persistence, batch review, agent schema, and idempotent push behavior.

## Important security posture

- Browser UI never calls Instantly.
- Browser UI does not receive Exa, Browserbase, Anthropic, or Instantly keys.
- The internal push endpoint fails closed unless `INTERNAL_API_SECRET` is configured.
- Only approved contacts are eligible for push.
- Push requires the review to be submitted first.
- Push worker is idempotent by `run_id + contact_id`.
- Campaign paused-state is enforced by the server-side push result contract.
- Review tokens are stored as SHA-256 hashes in Postgres, not raw tokens.

## Local dev without Postgres

This uses the in-memory fallback. Data resets when the process restarts.

```bash
npm install
npm run dev
```

Create a sample run:

```bash
curl -X POST http://localhost:3000/api/runs \
  -H 'Content-Type: application/json' \
  -d '{
    "company_name":"The Black Tux",
    "domain":"theblacktux.com",
    "mode":"fast",
    "source":"api",
    "campaign_id":"camp_test",
    "contacts":[{"first_name":"Alex","last_name":"Morgan","title":"VP CX","company":"The Black Tux","email":"alex@example.com","domain":"theblacktux.com"}]
  }'
```

Open the returned `review_url`, approve the contact, save, and submit.

## Local dev with Postgres

1. Copy env template:

```bash
cp .env.example .env.local
```

2. Set at minimum:

```bash
DATABASE_URL=postgres://user:password@host:5432/outbound
DATABASE_SSL=false # only for local non-SSL Postgres
INTERNAL_API_SECRET=replace-with-random-secret
APP_BASE_URL=http://localhost:3000
```

3. Apply schema:

```bash
npm run db:setup
npm run db:smoke
```

4. Start app:

```bash
npm run dev
```

When `DATABASE_URL` is present, `lib/store.ts` automatically routes all run/review/push state to Postgres.

## Vercel setup

Recommended Vercel project settings:

- Framework: Next.js
- Build command: `npm run build`
- Install command: `npm install`
- Output: Next.js default

Required Vercel environment variables:

```text
APP_BASE_URL=https://your-vercel-domain.vercel.app
DATABASE_URL=postgres://...
DATABASE_SSL=true
DATABASE_POOL_MAX=5
INTERNAL_API_SECRET=...
ANTHROPIC_API_KEY=...
EXA_API_KEY=...
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...
INSTANTLY_API_KEY=...
MCP_API_SECRET=...
MCP_AUTH_DISABLED=false
COWORK_API_BASE_URL=...
COWORK_API_KEY=***
COWORK_WEBHOOK_SECRET=***
REVIEW_SIGNING_SECRET=***
```

After setting `DATABASE_URL`, run the schema once against production:

```bash
npm run db:setup
npm run db:smoke
```

If using Vercel Postgres/Neon/Supabase, run that command from a machine with the same `DATABASE_URL`, or from Vercel's environment through your deployment workflow.

## Production readiness checklist

1. Provision Postgres and set `DATABASE_URL`, `DATABASE_SSL`, and `DATABASE_POOL_MAX`.
2. Apply and verify schema with `npm run db:setup` and `npm run db:smoke`. The smoke check validates required tables, ownership columns, and readiness indexes.
3. Push Vercel env with `npm run vercel:env:push`, then redeploy. Vercel env changes only affect new deployments.
4. Confirm the deployed `/api/mcp` endpoint responds to `initialize`, `tools/list`, and `tools/call` with `MCP_API_SECRET` configured.
5. Confirm Cowork can create a batch through MCP or `POST /api/webhooks/cowork/batch`, then poll `get_outbound_sequence_status` until `ready_for_review`.
6. Confirm internal batch processing and push endpoints return `401` without `INTERNAL_API_SECRET` and process successfully with it.

## Push endpoints

Single-run push endpoint:

```bash
curl -X POST "$APP_BASE_URL/api/internal/push/$RUN_ID" \
  -H "Authorization: Bearer $INTERNAL_API_SECRET"
```

Batch process and push endpoints:

```bash
curl -X POST "$APP_BASE_URL/api/internal/process-batch/$BATCH_ID" \
  -H "Authorization: Bearer $INTERNAL_API_SECRET"

curl -X POST "$APP_BASE_URL/api/internal/push-batch/$BATCH_ID" \
  -H "Authorization: Bearer $INTERNAL_API_SECRET"
```

They return `503` if `INTERNAL_API_SECRET` is not configured and `401` if the header is missing/wrong.

## Batch Cowork webhook

```bash
curl -X POST "$APP_BASE_URL/api/webhooks/cowork/batch" \
  -H "Content-Type: application/json" \
  -H "x-cowork-secret: $COWORK_WEBHOOK_SECRET" \
  -d '{
    "type":"outbound.batch.requested",
    "payload":{
      "thread_id":"cowork-thread-123",
      "campaign_id":"camp_test",
      "target_persona":"CX / Support leaders",
      "companies":[
        {"company_name":"The Black Tux","domain":"theblacktux.com","contacts":[{"first_name":"Alex","last_name":"Morgan","title":"VP CX","company":"The Black Tux","email":"alex@example.com"}]},
        {"company_name":"Kizik","domain":"kizik.com"}
      ]
    }
  }'
```

The response includes `batch_id`, `review_url`, and `process_url`. Company-only rows are allowed for account-level drafts, but they are intentionally not pushable until real contact emails are supplied.

## BDR cold outbound play

The first play-specific path uses `play_id: "bdr_cold_outbound"`. It reuses the same batch approval flow, but routes processing through the BDR play for retail/ecommerce account sequencing. The plugin or Cowork host should ask at most two follow-up turns before calling the tool: one to confirm the BDR play if intent is ambiguous, and one to collect missing company/domain/contact/title/campaign details.

Cowork determines the play; the app determines the contacts, sequence, and placeholders. If Cowork only supplies a company, BDR processing searches for public CX/support/eCommerce/digital candidates, runs a sequence-planning pass, then researches only the placeholders required by the selected Step 1 and Step 4 templates before writing drafts into review.

```bash
curl -X POST "$APP_BASE_URL/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MCP_API_SECRET" \
  -d '{
    "tool":"create_outbound_sequence",
    "input":{
      "actor":{"email":"bdr@example.com","cowork_thread_id":"thread-123"},
      "play_id":"bdr_cold_outbound",
      "play_metadata":{"intake":{"user_request_summary":"Sequence Kizik contacts through the BDR play.","confirmed_play":"bdr_cold_outbound","push_intent":"review_first"}},
      "campaign_id":"camp_test",
      "companies":[{
        "company_name":"Kizik",
        "domain":"kizik.com",
        "contacts":[
          {"name":"Alex Morgan","title":"VP of Customer Experience","email":"alex@example.com"},
          {"name":"Sam Lee","title":"Director of E-commerce"}
        ]
      }]
    }
  }'
```

BDR contacts without real emails are draftable but non-pushable. The review UI labels the generated manual drafts with their original play steps, usually Step 1 and Step 4. See `docs/bdr-play-intake.md` for the full plugin intake contract.

## Validation

```bash
npm test
npm run typecheck
npm run build
```

## Remaining production work

This repo is now wired for Vercel and Postgres, but these still need real account/environment configuration before live rollout:

1. Create/provision the actual Postgres database and set `DATABASE_URL` in Vercel.
2. Run `npm run db:setup` against that database.
3. Confirm the exact Instantly endpoint/payload mapping for the target workspace.
4. Confirm Cowork kickoff/timeline API integration.
5. Replace synchronous generation in `POST /api/runs` with Vercel Workflows/Queues or Trigger.dev for larger batches.
6. Add SSO/auth around `/admin/runs` and potentially review pages.
7. Add Sentry/observability and batch pagination.
