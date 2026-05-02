# Account Sequencer Skill

Revision: `bdr-vercel-pipeline-2026-05-01`

Source for the Cowork-facing `account-sequencer` skill. The installable
`.skill` archive is a generated artifact; edit this directory first, then
package it.

## Behavior

The skill asks:

1. `Do you want to run a fully custom sequence or the BDR outreach sequence play?`
2. If BDR is selected: `Do you have a CSV, or are you pasting in account names?`

BDR selections send `request_context` and should set `play_id:
"bdr_cold_outbound"` when explicit. The backend can infer the BDR play from
`request_context` or BDR-confirming metadata. Fully custom selections omit
`play_id`.

## Smoke Scenarios

### Company-only BDR

User: `Run the BDR sequence for Gruns.`

Expected handling:

- Ask custom vs BDR if not already clear.
- Ask CSV vs pasted account names after BDR is selected.
- Create a BDR batch with `request_context` and `play_id: "bdr_cold_outbound"`.
- Allow company-only input.
- Return the review dashboard after polling.

### BDR with supplied contact

User: `Sequence Quince with Jordan Lee, VP of Customer Experience.`

Expected handling:

- If BDR is selected, send Quince and the supplied contact/title.
- Email can be omitted for review-first.
- Do not choose the sequence in Cowork.

### Ambiguous intent

User: `Research this account.`

Expected handling:

- Ask whether they want a fully custom sequence or the BDR outreach sequence
  play before creating a batch.

### Fully custom

User: `Run a fully custom sequence for CX leaders at Quince.`

Expected handling:

- Do not set `play_id`.
- Pass the custom target/context through the generic Vercel AI SDK outbound
  agent with `target_persona` and `request_context` when known.

## Packaging

Run:

```bash
node scripts/package-account-sequencer-skill.mjs
```

The script writes `dist/account-sequencer.skill`.
