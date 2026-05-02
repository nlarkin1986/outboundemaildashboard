---
title: refactor: Audit Outbound Database, Agent, and MCP Readiness
type: refactor
status: active
date: 2026-04-29
---

# refactor: Audit Outbound Database, Agent, and MCP Readiness

## Overview

Run an audit-plus-fixes pass across the outbound approval app, focused on production readiness for Postgres persistence, the company agent/batch processor, and the MCP server contract. Security review and auth hardening are intentionally out of scope for this pass.

## Requirements Trace

- R1. Database setup scripts, schema, env docs, and runtime fallback behavior agree.
- R2. Batch agent processing can be retried without duplicating successful run rows for the same company.
- R3. MCP JSON-RPC lifecycle and tool-call responses match client expectations, including structured results and recoverable tool errors.
- R4. Deployment docs describe the database, vendor envs, MCP connectivity, Cowork connectivity, and verification steps.

## Scope Boundaries

- Security review, auth hardening, rate limiting, CORS policy, and secret-leakage auditing are deferred.
- Existing MCP tool names, review URLs, token format, and Postgres table names are preserved.

## Implementation Units

- [x] **Unit 1: Readiness Review Matrix**

  **Goal:** Create a tracked audit matrix covering database, agent, MCP protocol behavior, Vercel/env setup, tests, and docs.

  **Files:** `docs/outbound-readiness-audit.md`

  **Verification:** Findings are documented with evidence, fix, and verification status.

- [x] **Unit 2: Database Setup Hardening**

  **Goal:** Reconcile schema/setup docs with scripts and strengthen smoke validation.

  **Files:** `docs/schema.sql`, `scripts/db-url.mjs`, `scripts/smoke-db.mjs`, `tests/readiness-config.test.ts`

  **Verification:** Readiness tests validate schema/script parity and missing-URL behavior.

- [x] **Unit 3: Agent and Batch Flow Hardening**

  **Goal:** Make batch processing idempotent for repeated processing calls.

  **Files:** `lib/types.ts`, `lib/memory-store.ts`, `lib/postgres-store.ts`, `lib/jobs/processBatch.ts`, `tests/batch-review-flow.test.ts`

  **Verification:** Reprocessing an already completed batch does not create duplicate runs.

- [x] **Unit 4: MCP Protocol Compatibility**

  **Goal:** Improve MCP tool metadata, JSON-RPC tool result shape, and recoverable tool error handling.

  **Files:** `app/api/mcp/route.ts`, `tests/mcp-route.test.ts`

  **Verification:** Route tests cover initialize, tools/list, tools/call success, tool errors, unknown tools, and direct invocation compatibility.

- [x] **Unit 5: Deployment Checklist and Final Review**

  **Goal:** Update setup docs so launch steps are unambiguous.

  **Files:** `README.md`, `.env.example`, `vercel.json`

  **Verification:** Docs and env tests agree on required variables.

## Sources & References

- MCP overview: https://modelcontextprotocol.io/specification/2025-06-18/basic/index
- MCP tools spec: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- Vercel function duration docs: https://vercel.com/docs/functions/configuring-functions/duration
- Vercel env docs: https://vercel.com/docs/environment-variables
