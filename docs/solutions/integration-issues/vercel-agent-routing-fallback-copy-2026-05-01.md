---
title: Preventing Vercel Agent Routes from Falling Back to Static Outbound Copy
date: 2026-05-01
category: docs/solutions/integration-issues/
module: outbound-approval-vercel agent routing
problem_type: integration_issue
component: background_job
symptoms:
  - BDR or custom outbound batches showed old generic fallback subjects instead of agent-generated copy.
  - BDR-intended requests could poll as generic_company_agent or remain stuck in processing.
  - Production agent calls failed on Anthropic model aliases and structured-output schema constraints.
  - Review payloads could preserve stale fallback text in original_subject or original_body_html.
root_cause: logic_error
resolution_type: code_fix
severity: high
related_components:
  - mcp outbound tools
  - bdr play workflow
  - review persistence
  - vercel production runtime
tags: [vercel, ai-sdk, bdr-routing, firecrawl, fallback-copy, mcp, batch-processing]
---

# Preventing Vercel Agent Routes from Falling Back to Static Outbound Copy

## Problem

Outbound batch generation was reaching the review dashboard with old static generic copy instead of the intended Vercel AI SDK-backed BDR or custom output. The visible failure was repeated subjects such as `handoffs without the reset`, `full conversation history`, and `before it becomes urgent`, even when the user expected the BDR play or a generic agent to run.

The issue spanned routing, provider compatibility, Vercel execution behavior, and review persistence. A schema-only fix was not enough because production could advertise the right MCP fields while still failing inside the agent or preserving stale draft fields.

## Symptoms

- BDR-selected or BDR-intended batches showed generic fallback copy from `lib/agent/run-company-agent.ts`.
- `diagnostics.processing_route` could report `generic_company_agent` for work the user expected to route through `bdr_workflow`.
- Generic/custom batches could hang in `processing`, report `triggered_no_runs_yet`, or finish a run while the batch status stayed stale.
- Anthropic rejected production SDK calls because the code used stale model aliases or provider-incompatible structured output schemas.
- Review state could display corrected `subject` values while old fallback text survived in `original_subject` or `original_body_html`.

## What Didn't Work

- Treating this as prompt quality did not help. The bad copy came from a fallback writer and stale persisted fields, not from a weak prompt.
- Schema-only verification was insufficient (session history). Production could expose `play_id` and `play_metadata` while Cowork cache, old batches, runtime provider failures, or missing persistence updates still produced fallback copy.
- A first fail-closed approach for BDR metadata without `play_id` stopped silent generic fallback, but did not satisfy the desired behavior: the backend needed to infer or repair BDR routing when the request context clearly asked for the BDR play (session history).
- A generic `ToolLoopAgent` with Exa and Firecrawl was too slow for the generic path in Vercel, causing stuck `processing` batches or SDK fallback (session history).
- Unawaited processing triggers and a later `after()` attempt did not reliably start internal processing in Vercel; batches could remain at `triggered_no_runs_yet` (session history).
- Reusing strict app schemas directly for Anthropic structured output failed. Regex URL/email patterns, `propertyNames`, and integer constraints were rejected by the provider.

## Solution

Make the BDR route durable before batch creation, keep generic/custom generation AI SDK-backed but bounded, and ensure fallback or stale fields cannot surface the old static sequence.

### Repair BDR routing before persistence

`createOutboundSequence()` now resolves the route before calling `createBatch()`:

```ts
const routed = await resolveOutboundPlayRoute(data);
const routedInput = routed.input;

const batch = await createBatch({
  actor: data.actor,
  requested_by: owner.user.email,
  cowork_thread_id: data.actor.cowork_thread_id,
  campaign_id: routedInput.campaign_id ?? undefined,
  mode: routedInput.mode,
  source: 'cowork',
  play_id: routedInput.play_id,
  play_metadata: routedInput.play_metadata,
  target_persona: routedInput.target_persona,
  companies: routedInput.companies,
});
```

`lib/plays/bdr/intake-agent.ts` resolves BDR intent from explicit `play_id`, BDR-confirming metadata, request context heuristics, or the AI SDK intake agent. The durable backend selector remains `play_id: "bdr_cold_outbound"`; sequence variants are selected inside the BDR play, not through top-level play IDs.

### Split BDR and generic processing paths

`processBatch()` routes BDR work to the BDR workflow and all custom work to the generic company agent:

```ts
const bdrWorkflow = batch.play_id === BDR_PLAY_ID
  ? await runBdrPlayWorkflow({ company })
  : undefined;

const agentOutput = bdrWorkflow?.output ?? await runCompanyAgent({
  company: companyForAgent,
  targetPersona: targetPersonaFromMetadata(batch.play_metadata),
});
```

The generic target persona is persisted through `play_metadata.target_persona`, so custom requests do not lose their audience constraint during async processing.

### Use Firecrawl only where it is bounded

BDR placeholder research uses an AI SDK research agent with Exa and Firecrawl. Firecrawl is scoped to selected Step 1 and Step 4 lookup needs after sequence selection, rather than an open-ended generic research loop.

```ts
firecrawlScrape: tool({
  description: 'Scrape a specific URL through Firecrawl and return clean markdown evidence.',
  inputSchema: z.object({ url: z.string().url() }),
  execute: async ({ url }) => scrapeWithFirecrawl(url, { timeoutMs: 20000 }),
});
```

The generic/custom path moved away from a slow tool loop. It pre-fetches a small Exa evidence set and then uses AI SDK structured generation with a provider-safe schema.

```ts
const research = await searchPublicWeb(
  `${company.company_name} ${company.domain ?? ''} customer support ecommerce operations`,
  company.domain,
  3,
);

const result = await generateObject({
  model: anthropic(process.env.GENERIC_COMPANY_AGENT_MODEL ?? 'claude-haiku-4-5'),
  schema: genericCompanyAgentOutputSchema,
  system: genericAgentInstructions(),
  temperature: 0.2,
  maxOutputTokens: 1800,
  prompt: JSON.stringify({ company, target_persona: targetPersona, public_research: research }),
});
```

The example shows the project default used during this fix. For long-lived production use, prefer an explicitly verified/pinned provider model ID or configure `GENERIC_COMPANY_AGENT_MODEL` through the deployment environment.

### Keep provider schemas and model IDs compatible

The production failures included unpinned model aliases that were unsuitable for stable production behavior, plus provider rejection of strict JSON schema features. The fix was to move to deployment-configurable/current model IDs and a provider-facing schema without regex/property-name/integer constraints, then normalize into the stricter app schema after generation.

```ts
function normalizeAgentOutput(output: GenericCompanyAgentOutput, company: CompanyInput): CompanyAgentOutput {
  return companyAgentOutputSchema.parse({
    ...output,
    company_name: output.company_name || company.company_name,
    domain: output.domain || company.domain,
    evidence_ledger: output.evidence_ledger.map((item) => ({
      ...item,
      source_url: validUrl(item.source_url),
    })),
    contacts: output.contacts.map((contact, index) => {
      const supplied = suppliedContactAt(company, index);
      return {
        ...contact,
        ...supplied,
        email: (supplied?.email ?? contact.email).toLowerCase(),
        company: supplied?.company ?? contact.company ?? company.company_name,
        evidence_urls: contact.evidence_urls.map(validUrl).filter(Boolean),
      };
    }),
  });
}
```

### Keep processing and polling consistent

The internal Vercel processing trigger is awaited so trigger failures surface sooner and callers receive useful diagnostics. This is still not a durable queue: it consumes function duration and must be paired with route `maxDuration`/Vercel function limits. The MCP/status route also self-heals stale batch status when all runs have reached `ready_for_review`:

```ts
if (status === 'processing' && runs.length > 0 && runs.every((run) => run.status === 'ready_for_review') && !hasErrors) {
  status = 'ready_for_review';
  await updateBatchStatus(batch.id, status);
}
```

### Remove the old fallback strings from review payloads

The fallback writer still exists as a safety path, but it no longer emits the old repeated examples or KUHL proof copy. Review persistence also updates `original_subject` and `original_body_html` when replacing generated emails:

```ts
return {
  ...(existingEmail ?? { id: undefined, contact_id: contact.id }),
  step_number: agentEmail.step_number,
  original_step_number: agentEmail.original_step_number,
  step_label: agentEmail.step_label,
  original_subject: agentEmail.subject,
  original_body_html: agentEmail.body_html,
  subject: agentEmail.subject,
  body_html: agentEmail.body_html,
  body_text: agentEmail.body_text,
};
```

Without this, production smoke could pass the visible subject check while the serialized review payload still contained `before it becomes urgent` in `original_subject`.

## Why This Works

The fix makes routing explicit before persistence and keeps `play_id` as the durable source of truth. BDR work can be inferred or repaired from context, but once persisted it uses the same `bdr_cold_outbound` path as explicit requests.

It also separates agent orchestration by risk. BDR placeholder research can use Firecrawl because it is narrow and template-driven; generic/custom generation uses bounded evidence and direct structured generation so Vercel does not spend the request window on an open-ended tool loop.

Provider failures are no longer allowed to masquerade as successful outreach. The app now uses deployment-configurable model IDs, provider-safe generation schemas, post-generation app validation, safer fallback copy, and full review-field replacement.

Finally, production observability and status behavior now match how Cowork consumes the app: status polling exposes `bdr_workflow` vs `generic_company_agent`, provider configuration, deployment contract revision, and completed run counts.

## Prevention

- Keep `play_id` as the only durable backend route selector. Metadata and request text can repair the route, but downstream processing should branch on persisted `play_id`.
- Keep regression checks for known fallback strings in BDR and generic smoke payloads:

  ```ts
  expect(serialized).not.toMatch(
    /handoffs without the reset|full conversation history|before it becomes urgent/i
  );
  expect(serialized).not.toMatch(/KUHL: 44% reduction in WISMO emails/i);
  ```

- Treat production smoke as the real integration test. Local tests catch code regressions, but this bug depended on Vercel function duration, deployed env vars, Anthropic provider behavior, database persistence, and Cowork-style polling.
- Do not pass strict app schemas directly to AI providers without checking provider support. Use provider-safe schemas and normalize into stricter app schemas after generation.
- When replacing generated drafts, update both current editable fields and original draft fields so stale fallback copy cannot survive in serialized review state.
- Keep `scripts/verify-mcp-schema.mjs` and BDR smoke scripts aligned with the production MCP contract and route diagnostics.

## Related Issues

- [README.md](/Users/natelarkin/Desktop/outbound-approval-vercel/README.md) documents production schema verification, BDR smoke checks, provider configuration, and stale BDR batch triage.
- [docs/cowork-async-polling-instructions.md](/Users/natelarkin/Desktop/outbound-approval-vercel/docs/cowork-async-polling-instructions.md) documents route diagnostics and polling expectations.
- [docs/bdr-play-intake.md](/Users/natelarkin/Desktop/outbound-approval-vercel/docs/bdr-play-intake.md) documents BDR play intake and backend route inference.
- [docs/plans/2026-05-01-002-fix-bdr-routing-fallback-plan.md](/Users/natelarkin/Desktop/outbound-approval-vercel/docs/plans/2026-05-01-002-fix-bdr-routing-fallback-plan.md) covers the original routing fallback investigation.
- [docs/plans/2026-05-01-003-fix-vercel-bdr-pipeline-verification-plan.md](/Users/natelarkin/Desktop/outbound-approval-vercel/docs/plans/2026-05-01-003-fix-vercel-bdr-pipeline-verification-plan.md) covers live Vercel verification and production pipeline readiness.
