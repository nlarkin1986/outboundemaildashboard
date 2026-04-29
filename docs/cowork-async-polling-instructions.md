# Cowork async polling instructions

Use this wording in Cowork / Managed Agent workflow instructions for the Gladly outbound MCP tools.

## Core polling behavior

When you call `create_outbound_sequence`, treat the returned `batch_id` as the durable workflow handle.

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

If it returns `partially_failed`, summarize `errors`, present `dashboard_status_url`, and stop polling.

If it returns `failed`, surface the failure, present `dashboard_status_url`, and stop polling.

If it returns `review_submitted` or `pushed`, tell the user the review/push state and stop polling unless the user explicitly asks to check again.

## Guardrails

- Do not include generated email bodies or research payloads in Cowork deep links.
- Use `batch_id` plus backend status as the durable source of truth.
- Status polling must not start duplicate processing.
- If polling stops, resume with `get_outbound_sequence_status(batch_id, actor.email)`.
