# MCP BDR Handoff

Cowork determines whether the user selected the BDR outreach sequence play. The
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
  "target_persona": "CX leaders at ecommerce brands",
  "companies": [
    { "company_name": "Quince", "domain": "quince.com" }
  ]
}
```

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
