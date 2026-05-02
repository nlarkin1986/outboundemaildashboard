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
- Exa and Firecrawl server-side research seams.
- Cowork webhook/postback client with noop behavior until Cowork API env is configured.
- Vercel config with function duration hints.
- Tests for run validation, review persistence, batch review, agent schema, and idempotent push behavior.

## Important security posture

- Browser UI never calls Instantly.
- Browser UI does not receive Exa, Firecrawl, Anthropic, or Instantly keys.
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
FIRECRAWL_API_KEY=...
# Optional: enables JS-rendered page fallback for BDR prompt-pack research
BROWSERBASE_API_KEY=...
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
5. Verify the live MCP schema exposes the BDR routing contract before asking Cowork to create BDR batches:

```bash
MCP_URL="$APP_BASE_URL/api/mcp" MCP_API_SECRET="$MCP_API_SECRET" npm run mcp:schema:verify
```

The check is read-only. It must show `create_outbound_sequence` accepts `play_id`, `play_metadata`, and `bdr_cold_outbound`; otherwise Cowork may route BDR requests as generic batches from a stale schema.

6. Run one controlled BDR processing smoke against the deployed Vercel MCP endpoint, not localhost:

```bash
MCP_URL="$APP_BASE_URL/api/mcp" \
MCP_API_SECRET="$MCP_API_SECRET" \
BDR_SMOKE_ACTOR_EMAIL="your-internal-user@example.com" \
BDR_SMOKE_COMPANY_NAME="Gruns" \
BDR_SMOKE_COMPANY_DOMAIN="gruns.co" \
BDR_SMOKE_CONTACT_NAME="Jillian" \
BDR_SMOKE_CONTACT_TITLE="Director of Customer Experience" \
BDR_SMOKE_REQUIRE_VERCEL=true \
BDR_SMOKE_REQUIRE_DATABASE=true \
npm run mcp:bdr-smoke
```

The smoke creates a traceable review-first BDR batch, polls status, fetches review state, and fails if the output contains the generic company-agent subjects `handoffs without the reset`, `full conversation history`, or `before it becomes urgent`, or internal prompt/tool text. It must report `processing_route: "bdr_workflow"`, `diagnostics.deployment.prompt_pack_revision`, `diagnostics.bdr_personalization.optimized_dossier_path`, `fallback_causes`, and Vercel/database diagnostics before Cowork users create customer work.
The default smoke uses the current Gruns/Jillian failure shape, and the company/contact/title can be overridden with `BDR_SMOKE_COMPANY_NAME`, `BDR_SMOKE_COMPANY_DOMAIN`, `BDR_SMOKE_CONTACT_NAME`, and `BDR_SMOKE_CONTACT_TITLE`. The output also prints the deployment `contract_revision`; compare it with the installed account-sequencer skill revision before enabling Cowork.

7. Run the multi-company BDR live eval against the deployed Vercel MCP endpoint before a broader rollout:

```bash
MCP_URL="$APP_BASE_URL/api/mcp" \
MCP_API_SECRET="$MCP_API_SECRET" \
BDR_EVAL_ACTOR_EMAIL="your-internal-user@example.com" \
npm run mcp:bdr-eval
```

The eval creates one review-first BDR batch per company with company-only input and `target_persona: "CX leaders"`. The default canary list is Gruns, The Black Tux, Quince, Manscapped, and Alo Yoga. `Manscapped` is intentionally submitted exactly as written and flagged as ambiguous unless you override it with a domain or normalized company input. Use `BDR_EVAL_COMPANIES="Gruns|gruns.co,Alo Yoga|aloyoga.com"` or `BDR_EVAL_COMPANIES_JSON` to override the list, and use `BDR_EVAL_RERUN_FROM=/path/to/artifact.json` to rerun only `warn` and `fail` rows from a prior artifact.

Artifacts are written to `tmp/bdr-live-e2e-eval/` by default, or `BDR_EVAL_OUTPUT_DIR` when set. `pass` means routing, diagnostics, review-state safety, and Step 1/Step 4 shape passed for that row. `warn` means output stayed safe but needs human review for issues such as missing real email, weak evidence fallback, unsupported title mapping, or the ambiguous `Manscapped` input. `fail` means stop rollout: examples include `generic_company_agent` routing, missing required BDR diagnostics, generic fallback copy, prompt/tool leakage, unresolved bracket placeholders, or a contact that appears pushable despite missing email or blocked BDR sequence.

8. Confirm required BDR intake and research providers are configured. `ANTHROPIC_API_KEY` enables the Vercel AI SDK intake and research agents. `EXA_API_KEY` should be present for discovery/search, and `FIRECRAWL_API_KEY` should be present for clean page extraction before filling placeholders. `BROWSERBASE_API_KEY` is optional and only used as a final fallback for JS-rendered pages when implemented/configured. If either required research provider is missing, BDR output may contain BDR-specific research warnings, but it must not fall back to the generic three-email company-agent sequence.
9. Refresh or reconnect the Cowork MCP wrapper after the live schema, processing smoke, and live eval checks pass, so any cached tool schema includes `play_id`, `play_metadata`, and the expected `contract_revision`.
10. Confirm Cowork can create a batch through MCP or `POST /api/webhooks/cowork/batch`, then poll `get_outbound_sequence_status` until `ready_for_review`. The returned `diagnostics.processing_route` should be `bdr_workflow` for BDR batches and `generic_company_agent` only for fully custom batches.
11. Confirm internal batch processing and push endpoints return `401` without `INTERNAL_API_SECRET` and process successfully with it.

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

The first play-specific path uses `play_id: "bdr_cold_outbound"`. It reuses the same batch approval flow, but routes processing through the BDR play for retail/ecommerce account sequencing. The plugin or Cowork host should pass `request_context`; the Vercel AI SDK intake agent can infer and fill the BDR play metadata when `play_id` is missing. Ask at most two follow-up turns before calling the tool: one to confirm the BDR play if intent is ambiguous, and one to collect missing company/domain/contact/title/campaign details.

Before enabling the Cowork skill for BDR use, verify the deployed MCP schema, run the BDR processing smoke, run the multi-company BDR live eval with `npm run mcp:bdr-eval`, and refresh Cowork's cached tool schema. If `npm run mcp:schema:verify` does not see `play_id`, `play_metadata`, and `bdr_cold_outbound` on the live endpoint, BDR requests will create generic batches even if the skill instructions mention the BDR play. If `npm run mcp:bdr-smoke` or `npm run mcp:bdr-eval` reports generic company-agent subjects such as `handoffs without the reset`, `full conversation history`, or `before it becomes urgent`, stop rollout and debug BDR routing before creating customer batches.

The server-side intake agent determines the play when Cowork does not provide a durable `play_id`; the app determines the contacts, sequence, and placeholders. If Cowork only supplies a company, BDR processing searches for public CX/support/eCommerce/digital candidates, runs a sequence-planning pass, then researches only the placeholders required by the selected Step 1 and Step 4 templates before writing drafts into review.

BDR research is prompt-pack driven. The source playbook lives in `docs/bdr-cold-outbound-prompt-pack.md`, while runtime generation passes only the selected sequence's Step 1 and Step 4 prompt slices into the Vercel AI SDK research agent. Weak evidence intentionally uses a generic opener or Version B branch and records review warnings instead of forcing unsupported personalization.

Fully custom batches intentionally omit `play_id`. Those batches now run through the generic Vercel AI SDK company agent, which can use Exa search, Firecrawl page extraction, and public people search before returning the standard review schema. The static generic writer remains only as an infrastructure fallback when the SDK agent is disabled or unavailable.

```bash
curl -X POST "$APP_BASE_URL/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MCP_API_SECRET" \
  -d '{
    "tool":"create_outbound_sequence",
    "input":{
      "actor":{"email":"bdr@example.com","cowork_thread_id":"thread-123"},
      "request_context":"Sequence Kizik contacts through the BDR play.",
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

BDR create/status responses include sanitized `diagnostics` so operators can distinguish expected routing and runtime state without exposing secrets. Create responses also include `routing.source`: `explicit_play_id`, `metadata`, `heuristic`, or `vercel_agent_sdk`. For BDR batches, `diagnostics.processing_route` must be `bdr_workflow`; `generic_company_agent` means the batch was treated as fully custom. `diagnostics.bdr_personalization.optimized_dossier_path` confirms the dossier-first personalization path is live, and `fallback_causes` lists the safe fallback categories operators should expect: weak evidence, provider configuration, provider failure, agent failure, or blocked sequence mapping.

For live rollout checks, `npm run mcp:bdr-eval` submits company-only batches for Gruns, The Black Tux, Quince, Manscapped, and Alo Yoga looking for CX leaders. It writes a JSON report under `tmp/bdr-live-e2e-eval/` and separates hard failures from rollout warnings. Warning-only rows are expected when contact discovery lacks verified emails or public evidence is weak; hard failures such as `generic_company_agent` routing, generic fallback copy, prompt/tool leakage, unresolved BDR placeholders, or unsafe pushability should stop rollout.

### Stale BDR batch triage

Use this checklist before editing or approving a review URL that was meant to be BDR output:

1. Poll `get_outbound_sequence_status` for the batch ID. BDR-intended work must include `play_id: "bdr_cold_outbound"` and `diagnostics.processing_route: "bdr_workflow"`.
2. Compare `diagnostics.deployment.contract_revision` with the installed `account-sequencer` skill revision. If they differ, refresh/reconnect the Cowork MCP wrapper and recreate the batch.
3. Check `diagnostics.bdr_personalization.optimized_dossier_path`. If it is missing, the deployment is too old for the dossier-first BDR snippet path.
4. Open `/admin/runs?batch_id=batch_...` and check route triage. `Suspect BDR fallback` means BDR intent is present but the review copy matches generic company-agent fallback text.
5. If the review output contains `handoffs without the reset`, `full conversation history`, or `before it becomes urgent` for a BDR-selected request, do not approve or edit it as BDR copy. Recreate it after the deployed schema, skill revision, and live smoke pass.
6. Generic/custom output is acceptable only for the fully custom path where `play_id` is intentionally omitted. In configured environments, that path should come from the generic Vercel AI SDK company agent; the static generic writer is only a runtime fallback.

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
