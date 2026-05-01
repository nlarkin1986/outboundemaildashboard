# Outbound Readiness Audit

Date: 2026-04-29

Scope: database setup, company agent/batch processing, MCP protocol compatibility, Vercel/env setup, tests, and docs. Security review and auth hardening are deferred by request.

| Area | Finding | Evidence | Fix | Verification |
| --- | --- | --- | --- | --- |
| Database | Smoke check only verified tables and four ownership columns, so index/schema drift could pass unnoticed. | `scripts/smoke-db.mjs`, `docs/schema.sql` | Added required index checks and expected batch company key migration checks. | `tests/readiness-config.test.ts` |
| Database | `DATABASE_URL` parsing accepted any URL protocol before constructing the pg connection string. | `scripts/db-url.mjs`, `lib/db.ts` | Centralized script-side parsing and reject non-Postgres protocols. Runtime DB helper already throws when unset. | `tests/readiness-config.test.ts` |
| Agent | Re-running `processBatch` for the same batch created duplicate runs for already processed companies. | `lib/jobs/processBatch.ts`, `lib/store.ts`, `batch_runs` schema | Added a stable `company_key` per batch/company and made processing skip existing ready rows. | `tests/batch-review-flow.test.ts` |
| Agent | Batch run rows did not expose a stable company identity, making idempotency rely on generated run IDs. | `docs/schema.sql`, `lib/types.ts`, store implementations | Added `company_key` to `BatchRun` and storage layers with a unique Postgres index. | `tests/batch-review-flow.test.ts` |
| MCP | Tool execution errors were returned as HTTP 400 JSON errors, which makes MCP clients treat recoverable business errors as transport/protocol failures. | `app/api/mcp/route.ts` | Return JSON-RPC tool execution errors as `result.isError = true`; keep unknown methods/tools as protocol errors. | `tests/mcp-route.test.ts` |
| MCP | Tool metadata did not publish output schemas, limiting client validation and discoverability. | `app/api/mcp/route.ts` | Added output schemas for both MCP tools. | `tests/mcp-route.test.ts` |
| Docs / deploy | Launch docs did not separate schema setup, DB smoke, env push, redeploy, MCP smoke, and internal job verification into one checklist. | `README.md` | Added a production readiness checklist and updated required env list. | `tests/readiness-config.test.ts` |
