---
name: account-sequencer
description: >
  Cowork orchestration skill for Gladly outbound sequence requests. Use when a
  user asks to sequence accounts, run outreach, build outbound for companies, or
  prepare BDR outreach. Ask whether they want a fully custom sequence or the BDR
  outreach sequence play. Only the BDR play sets play_id to bdr_cold_outbound;
  the fully custom path omits play_id and uses the generic outbound workflow.
---

# Account Sequencer

Use this skill to route outbound sequence requests into the Gladly approval
workflow. The skill does not write final email copy inline. It creates a
backend batch, polls for status, and gives the user the review dashboard.

## First question

Ask this before BDR-specific intake:

```text
Do you want to run a fully custom sequence or the BDR outreach sequence play?
```

## Branching

### Fully custom sequence

If the user selects a fully custom sequence:

1. Do not set `play_id`.
2. Collect the company/account names, domains when known, any supplied contacts,
   target persona or custom instructions, and campaign target when relevant.
3. Call `create_outbound_sequence` through the generic outbound path.
4. Poll with `get_outbound_sequence_status`.
5. Return the review URL and dashboard status URL.

There is no custom `play_id` today. Omitting `play_id` is the current
generic/custom research-to-sequence workflow.

### BDR outreach sequence play

If the user selects the BDR outreach sequence play, ask the second question:

```text
Do you have a CSV, or are you pasting in account names?
```

Then collect the input from the selected format:

- CSV: parse company/account names, domains, contact names, titles, emails, and
  campaign IDs when present.
- Pasted accounts: collect company/account names. Domains, contacts, titles, and
  emails are optional.

For BDR, call `create_outbound_sequence` with:

```json
{
  "play_id": "bdr_cold_outbound"
}
```

The Vercel workflow chooses the exact BDR sequence, discovers account-matched
contacts when contacts are missing, researches placeholders, renders the email
sequence, previews the LinkedIn note, and saves warnings into the review flow.

## Required behavior

- Ask no more than two follow-up turns in the common path.
- Do not choose the BDR brand type, persona, sequence code, subjects, or
  personalization placeholders in Cowork.
- Do not invent company domains, contact titles, contact emails, current
  employers, review findings, or product signals.
- Company-only BDR input is allowed. The backend can still produce review-first
  drafts and warnings.
- Missing or placeholder emails are non-pushable until the reviewer adds real
  emails in the dashboard.
- Use `batch_id` as the durable workflow handle.
- Use the review dashboard as the source of truth for generated email copy,
  evidence, warnings, and LinkedIn preview.
- Do not paste generated email bodies or raw research payloads into Cowork as
  the primary output.

## References

Read these before calling tools:

- `references/mcp-bdr-handoff.md`
- `references/polling.md`
