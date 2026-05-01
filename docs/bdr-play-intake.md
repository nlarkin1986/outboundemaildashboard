# BDR play intake

The first play-specific workflow is `bdr_cold_outbound`. It is intentionally explicit rather than a general play registry.

## Plugin intake behavior

When a BDR asks to "sequence this account" or names a company plus contacts/titles, the host agent should:

1. Ask: "Do you want to run a fully custom sequence or the BDR outreach sequence play?"
2. If the user selects the BDR outreach sequence play, ask: "Do you have a CSV, or are you pasting in account names?"
3. Parse the selected input format for company, domain when known, any supplied contact details, optional email, and campaign target information.
4. Call `create_outbound_sequence` with `play_id: "bdr_cold_outbound"`.

In the common path, ask no more than two follow-up turns before creating the batch.

Cowork determines that the user wants the BDR play. The Vercel-side BDR workflow can discover contact/persona candidates when Cowork only supplies the company, then determines the specific sequence code and runs the research needed to fill that selected sequence.

If the user selects a fully custom sequence, do not set `play_id`. The current generic/custom research-to-sequence path is represented by omitting `play_id`.

## Required inputs

- `actor.email`
- `play_id: "bdr_cold_outbound"`
- At least one company with `company_name`
- Contact titles when Cowork already has them

Contact names, titles, and emails are optional for review-only drafting. If they are missing, the BDR workflow searches for public CX/support/eCommerce/digital candidates. Contacts without real emails are created with `example.invalid` placeholder emails and cannot be pushed to Instantly until a real email is supplied.

## Example MCP call

```json
{
  "actor": { "email": "bdr@example.com", "cowork_thread_id": "thread-123" },
  "play_id": "bdr_cold_outbound",
  "play_metadata": {
    "intake": {
      "user_request_summary": "Sequence Kizik contacts through the BDR play.",
      "confirmed_play": "bdr_cold_outbound",
      "known_missing_fields": ["email"],
      "input_format": "pasted_accounts",
      "push_intent": "review_first"
    }
  },
  "campaign_id": "camp_paused_review",
  "companies": [
    {
      "company_name": "Kizik",
      "domain": "kizik.com",
      "contacts": [
        {
          "name": "Alex Morgan",
          "title": "VP of Customer Experience",
          "email": "alex@example.com"
        },
        {
          "name": "Sam Lee",
          "title": "Director of E-commerce"
        }
      ]
    }
  ]
}
```

## Review output

BDR generation runs in two passes:

1. Sequence planning: account/category and contact-title research selects the BDR sequence code or produces a warning-only mapping.
2. Placeholder research: only the selected Step 1 / Step 4 lookup needs are researched and substituted into the controlled templates.

The review UI shows the original BDR play step labels:

- `Step 1: Email · peer story`
- `Step 4: Email · benchmarks / data`

The internal review order remains `1`, `2`, etc. for editing and push compatibility, while `original_step_number` preserves the BDR play step number.

## Warnings

Reviewers should expect warnings for:

- Unsupported brand categories outside retail/ecommerce/DTC
- Contact titles that do not map to a supported BDR persona
- Missing real emails
- Thin or unavailable public research

Warnings are designed to keep the workflow review-safe. They should not be hidden from the reviewer or treated as successful personalization.
