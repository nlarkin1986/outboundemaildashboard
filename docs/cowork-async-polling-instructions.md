# Cowork async polling instructions

Use this wording in Cowork / Managed Agent workflow instructions for the Gladly outbound MCP tools.

## Core polling behavior

When you call `create_outbound_sequence`, treat the returned `batch_id` as the durable workflow handle.

For sequence requests, first ask: "Do you want to run a fully custom sequence or the BDR outreach sequence play?"

If the user selects the BDR outreach sequence play, ask: "Do you have a CSV, or are you pasting in account names?" Then pass `request_context`, set `play_id` to `bdr_cold_outbound` when explicit, and parse the selected input format for company, domain when known, any supplied contact details, optional emails, and campaign target information.

If the user selects a fully custom sequence, do not set `play_id`. The current generic/custom research-to-sequence path is represented by omitting `play_id`.

If metadata says the BDR play was confirmed, the backend will now repair a missing durable `play_id` by selecting `bdr_cold_outbound` before creating the batch. Still send `request_context` so the Vercel AI SDK intake agent can classify ambiguous account-sequencing requests and fill `play_metadata.intake`.

Cowork should not choose the BDR sequence variant. If Cowork does not have contact names or titles, the backend workflow searches for public CX/support/eCommerce/digital candidates. The backend uses the supplied or discovered company/contact context and public research to choose the sequence, then performs a second targeted research pass for only the placeholders required by that selected sequence.

If the response status is `queued`, `processing`, or `pushing`, do not tell the user the workflow is complete. Wait `recommended_poll_after_seconds`, then call `get_outbound_sequence_status` with:

- `batch_id` from the create response
- `actor.email` for the current Cowork user

Repeat until one of these statuses is returned:

- `ready_for_review`
- `partially_failed`
- `failed`
- `review_submitted`
- `pushed`

Default polling cadence is 30 seconds, max 8 attempts. If max attempts are reached and the job is still `queued`, `processing`, or `pushing`, tell the user the job is still running and provide `dashboard_status_url`. The user or Cowork can resume later by calling `get_outbound_sequence_status` with the same `batch_id`.

Never draft from memory after polling. Use the latest `get_outbound_sequence_status` result and dashboard/review URLs as source of truth.

## Example create response handling

If `create_outbound_sequence` returns:

```json
{
  "ok": true,
  "batch_id": "batch_abc123",
  "status": "processing",
  "review_url": "https://example.com/review/batch/token",
  "dashboard_status_url": "https://example.com/admin/runs?batch_id=batch_abc123",
  "poll_tool": "get_outbound_sequence_status",
  "recommended_poll_after_seconds": 30,
  "max_poll_attempts": 8,
  "is_terminal": false,
  "cowork_next_action": {
    "state": "processing",
    "instruction": "The outbound batch is still processing. Wait about 30 seconds, then call get_outbound_sequence_status again with the same batch_id and actor.email."
  }
}
```

Cowork should say the batch has started, wait about 30 seconds, then call:

```json
{
  "batch_id": "batch_abc123",
  "actor": { "email": "current-user@company.com" }
}
```

## Example terminal response handling

If `get_outbound_sequence_status` returns `ready_for_review`, present the `review_url` and `dashboard_status_url`, summarize any `run_counts`, and stop polling.

For BDR batches, check the returned `diagnostics.processing_route`. It must be `bdr_workflow`. If it is `generic_company_agent`, treat the batch as a routing failure and do not summarize the generated copy as BDR output.
Also compare `diagnostics.deployment.contract_revision` with the installed account-sequencer skill revision. If they do not match, refresh/reconnect the Cowork MCP wrapper before creating customer work.
Also check `diagnostics.deployment.prompt_pack_revision` when investigating BDR output quality. If the prompt pack revision is missing, the deployment is too old for optimized prompt-pack-driven research.
Also check `diagnostics.bdr_personalization.optimized_dossier_path` and `fallback_causes`. Missing dossier diagnostics mean the deployment predates the dossier-first snippet path; fallback causes are expected to be sanitized categories, not raw provider traces.
Before broad rollout, operators should run `npm run mcp:bdr-eval` against the deployed endpoint. That live eval submits company-only BDR batches for Gruns, The Black Tux, Quince, Manscapped, and Alo Yoga looking for CX leaders, then reports `pass`, `warn`, or `fail` rows from the MCP and review-state contracts. `warn` rows can reflect safe missing-email or weak-evidence fallback behavior; `fail` rows such as `generic_company_agent` routing, generic fallback copy, prompt/tool leakage, unresolved BDR placeholders, or unsafe pushability should stop rollout.

If it returns `partially_failed`, summarize `errors`, present `dashboard_status_url`, and stop polling.

If it returns `failed`, surface the failure, present `dashboard_status_url`, and stop polling.

If it returns `review_submitted` or `pushed`, tell the user the review/push state and stop polling unless the user explicitly asks to check again.

## Guardrails

- Do not include generated email bodies or research payloads in Cowork deep links.
- For `bdr_cold_outbound`, do not invent titles, brand categories, emails, or review findings. Missing or unsupported values should become review warnings.
- For `bdr_cold_outbound`, the backend uses the selected sequence's prompt-pack slice and may intentionally fall back to generic openers when public evidence is weak.
- For `bdr_cold_outbound`, generic subjects such as `handoffs without the reset`, `full conversation history`, or `before it becomes urgent` mean the generic company-agent route ran. Stop and report a routing issue instead of asking the user to approve that copy.
- Use `batch_id` plus backend status as the durable source of truth.
- Status polling must not start duplicate processing.
- If polling stops, resume with `get_outbound_sequence_status(batch_id, actor.email)`.
