# Polling

Revision: `bdr-vercel-pipeline-2026-05-01`

After calling `create_outbound_sequence`, treat `batch_id` as the durable handle.
Do not create another batch to check progress.

Call `get_outbound_sequence_status` with:

```json
{
  "batch_id": "batch_abc123",
  "actor": { "email": "current-user@example.com" }
}
```

## Polling states

Continue polling while status is:

- `queued`
- `processing`
- `pushing`

Use `recommended_poll_after_seconds` from the tool response. Stop after
`max_poll_attempts`; tell the user the job is still running and provide the
`dashboard_status_url`.

## Terminal or user-action states

When status is `ready_for_review`, present:

- `review_url`
- `dashboard_status_url`
- high-level run counts when present

When status is `partially_failed` or `failed`, summarize the error state and
present `dashboard_status_url`.

When status is `review_submitted` or `pushed`, tell the user the current state
and stop polling unless they ask to check again.

Do not paste generated email bodies, LinkedIn notes, or raw research payloads
into Cowork as the primary result. The dashboard is the source of truth.

For BDR-selected requests, stop and report a routing issue if
`diagnostics.processing_route` is `generic_company_agent` or if the returned
`diagnostics.deployment.contract_revision` does not match the installed skill
revision.
