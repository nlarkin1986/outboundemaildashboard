# MCP BDR Handoff

Revision: `bdr-vercel-pipeline-2026-05-01`

Cowork should pass the original request in `request_context`. The Vercel AI SDK
intake agent determines whether the request belongs to the BDR outreach sequence
play when `play_id` is missing, then fills durable BDR intake metadata. The
Vercel workflow determines everything inside the BDR play: brand type, contact
candidate handling, persona, exact sequence code, placeholder research, email
rendering, LinkedIn note preview, evidence, and warnings.

## BDR create call

Use this shape after the user selects the BDR outreach sequence play:

```json
{
  "actor": {
    "email": "bdr@example.com",
    "cowork_thread_id": "thread-123"
  },
  "request_context": "Run the BDR outreach sequence play for these accounts.",
  "play_id": "bdr_cold_outbound",
  "play_metadata": {
    "intake": {
      "user_request_summary": "Run the BDR outreach sequence play for these accounts.",
      "confirmed_play": "bdr_cold_outbound",
      "known_missing_fields": ["email"],
      "input_format": "csv",
      "push_intent": "review_first"
    }
  },
  "campaign_id": "optional_campaign_id",
  "companies": [
    {
      "company_name": "Gruns",
      "domain": "gruns.co",
      "contacts": [
        {
          "name": "Jordan Lee",
          "title": "VP of Customer Experience",
          "email": "jordan@example.com"
        }
      ]
    }
  ]
}
```

Allowed BDR input can be as small as:

```json
{
  "actor": { "email": "bdr@example.com" },
  "request_context": "Sequence these accounts for BDR outreach.",
  "play_id": "bdr_cold_outbound",
  "play_metadata": {
    "intake": {
      "confirmed_play": "bdr_cold_outbound",
      "input_format": "pasted_accounts",
      "push_intent": "review_first"
    }
  },
  "companies": [
    { "company_name": "Gruns", "domain": "gruns.co" }
  ]
}
```

## Fully custom create call

For a fully custom sequence, omit `play_id`:

```json
{
  "actor": {
    "email": "bdr@example.com",
    "cowork_thread_id": "thread-123"
  },
  "request_context": "Build a fully custom outbound sequence for CX leaders at ecommerce brands.",
  "target_persona": "CX leaders at ecommerce brands",
  "companies": [
    { "company_name": "Quince", "domain": "quince.com" }
  ]
}
```

The backend stores `target_persona` in batch metadata and passes it to the
generic Vercel AI SDK company agent. Use `request_context` for the human
instruction and `target_persona` for the audience/persona constraint.

## Do not send

Do not add these to the create call:

- `sequence_code`
- brand type
- persona code
- selected placeholders
- generated subjects
- generated email bodies
- LinkedIn note copy
- raw research findings

Those are backend-owned outputs and appear in the review dashboard.

## Route verification

After create and status calls, compare the returned
`diagnostics.deployment.contract_revision` with this skill revision. If the
response is for a BDR-selected request and reports
`diagnostics.processing_route: "generic_company_agent"`, stop and report a
routing issue instead of summarizing or approving the generated copy.
