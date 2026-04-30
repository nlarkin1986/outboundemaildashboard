# BDR play intake

The first play-specific workflow is `bdr_cold_outbound`. It is intentionally explicit rather than a general play registry.

## Plugin intake behavior

When a BDR asks to "sequence this account" or names a company plus contacts/titles, the host agent should:

1. Confirm the BDR cold outbound play only when intent is ambiguous.
2. Collect missing company, domain when known, contact name, contact title, optional email, and campaign target information.
3. Call `create_outbound_sequence` with `play_id: "bdr_cold_outbound"`.

In the common path, ask no more than two follow-up turns before creating the batch.

## Required inputs

- `actor.email`
- `play_id: "bdr_cold_outbound"`
- At least one company with `company_name`
- Contact titles for any contact that should be mapped to a BDR sequence

Contact emails are optional for review-only drafting. Contacts without real emails are created with `example.invalid` placeholder emails and cannot be pushed to Instantly until a real email is supplied.

## Example MCP call

```json
{
  "actor": { "email": "bdr@example.com", "cowork_thread_id": "thread-123" },
  "play_id": "bdr_cold_outbound",
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
