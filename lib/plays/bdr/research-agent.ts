import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { CompanyInput } from '@/lib/schemas';
import type { BdrResearchBundle, BdrResearchFinding } from './research';
import { BDR_PROMPT_PACK_REVISION, bdrPromptPackSlice, bdrPromptPackSlices } from './prompt-pack';
import type { BdrEvidenceType, BdrFallbackCause, BdrLookupKey, BdrPersonalizationInsert, BdrSequenceTemplate } from './types';

const evidenceTypes = ['product', 'help_center', 'jobs', 'press', 'reviews', 'social', 'inference'] as const;
const fallbackCauses = ['weak_evidence', 'provider_configuration', 'provider_failure', 'agent_failure', 'blocked_sequence_mapping'] as const;

const insertSchema = z.object({
  selected_insert: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  evidence_type: z.enum(evidenceTypes),
  verified_fact: z.string().optional(),
  inference_used: z.string().optional(),
  source_url: z.string().optional(),
  source_snippet: z.string().optional(),
  fallback_used: z.boolean(),
  warning: z.string().optional(),
  fallback_cause: z.enum(fallbackCauses).optional(),
  qualification_rationale: z.string().optional(),
});

const findingSchema = z.object({
  value: z.string().optional(),
  insert: insertSchema,
  evidence_urls: z.array(z.string()),
  warning: z.string().optional(),
});

const placeholderOutputSchema = z.object({
  step1: findingSchema,
  step4: findingSchema,
  warnings: z.array(z.string()),
});

type AgentPlaceholderOutput = z.infer<typeof placeholderOutputSchema>;

function generalPrompt() {
  return [
    'You are the BDR personalization insert judge for Gladly retail/eCommerce outbound.',
    'Do not use web research or memory. Judge only the supplied compact dossier evidence.',
    `Prompt pack revision: ${BDR_PROMPT_PACK_REVISION}.`,
    'Use only the selected sequence prompt slices in the user prompt. Do not apply rules from unrelated BDR sequences.',
    'Every personalized line must trace to one supplied source URL and source snippet.',
    'Separate verified facts from inferred operating pressure.',
    'Do not claim the company has a pain unless public evidence proves it.',
    'Use soft inference such as likely creates, usually creates, can create.',
    'Output one sentence per selected_insert, ideally under 25 words.',
    'No research-process language: do not say I noticed, I saw, I was looking at, pulled up, or spent time on.',
    'If evidence is weak, set fallback_used true and do not include selected_insert.',
  ].join('\n');
}

function fallbackFinding(lookup: BdrLookupKey, warning: string): BdrResearchFinding {
  return {
    evidence_urls: [],
    warning,
    insert: {
      confidence: 'low',
      evidence_type: lookup === 'review_pattern' ? 'reviews' : 'inference',
      fallback_used: true,
      warning,
      fallback_cause: 'agent_failure',
    },
  };
}

function fallbackFromFinding({
  lookup,
  finding,
  warning,
  cause = 'agent_failure',
}: {
  lookup: BdrLookupKey;
  finding: BdrResearchFinding;
  warning: string;
  cause?: BdrFallbackCause;
}): BdrResearchFinding {
  return {
    evidence_urls: finding.evidence_urls,
    warning,
    insert: {
      confidence: 'low',
      evidence_type: finding.insert?.evidence_type ?? (lookup === 'review_pattern' ? 'reviews' : 'inference'),
      verified_fact: finding.insert?.verified_fact,
      source_url: finding.insert?.source_url,
      source_snippet: finding.insert?.source_snippet,
      fallback_used: true,
      warning,
      fallback_cause: cause,
      qualification_rationale: finding.insert?.qualification_rationale,
    },
    dossier: finding.dossier,
  };
}

function allowedEvidenceUrls(finding: BdrResearchFinding) {
  return new Set([
    ...finding.evidence_urls,
    ...(finding.dossier?.items.map((item) => item.source_url) ?? []),
  ].filter(Boolean));
}

function containsResearchProcessLanguage(value?: string) {
  return /\b(i noticed|i saw|i was looking|looking at|spent time|pulled up|according to|tool|prompt|dossier|source snippet|\[selected_insert\]|personalize)\b/i.test(value ?? '');
}

export function normalizeBdrSynthesisFinding({
  lookup,
  finding,
  output,
}: {
  lookup: BdrLookupKey;
  finding: BdrResearchFinding;
  output: z.infer<typeof findingSchema>;
}): BdrResearchFinding {
  const insert: BdrPersonalizationInsert = {
    ...output.insert,
    evidence_type: output.insert.evidence_type as BdrEvidenceType,
    selected_insert: output.insert.fallback_used ? undefined : output.insert.selected_insert,
    source_snippet: output.insert.source_snippet?.slice(0, 240),
  };

  if (!insert.fallback_used && !insert.selected_insert) {
    return fallbackFromFinding({ lookup, finding, warning: output.warning ?? 'BDR synthesis returned no selected insert; used fallback.' });
  }
  if (insert.fallback_used) {
    return fallbackFromFinding({
      lookup,
      finding,
      warning: output.warning ?? insert.warning ?? finding.warning ?? 'BDR synthesis selected the safe fallback.',
      cause: insert.fallback_cause ?? finding.insert?.fallback_cause ?? 'weak_evidence',
    });
  }
  if (!insert.source_url || !allowedEvidenceUrls(finding).has(insert.source_url)) {
    return fallbackFromFinding({ lookup, finding, warning: 'BDR synthesis selected evidence outside the dossier; used fallback.' });
  }
  if (containsResearchProcessLanguage(insert.selected_insert)) {
    return fallbackFromFinding({ lookup, finding, warning: 'BDR synthesis returned research-process language; used fallback.' });
  }

  return {
    value: output.value ?? insert.selected_insert,
    insert,
    evidence_urls: output.evidence_urls.filter(Boolean),
    warning: output.warning ?? insert.warning,
    dossier: finding.dossier,
  };
}

function agentEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.BDR_RESEARCH_AGENT_DISABLED !== 'true';
}

function intEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`BDR synthesis agent timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}

export function bdrResearchAgentPrompt({ company, sequence }: { company: CompanyInput; sequence: BdrSequenceTemplate }) {
  const [step1Prompt, step4Prompt] = bdrPromptPackSlices(sequence.code);
  return {
    prompt_pack_revision: BDR_PROMPT_PACK_REVISION,
    company,
    sequence: {
      code: sequence.code,
      brand_label: sequence.brand_label,
      persona_label: sequence.persona_label,
      language_constraints: step1Prompt.language_constraints,
      step1: {
        subject: sequence.step1.subject,
        lookup: sequence.step1.lookup,
        prompt: step1Prompt.instruction,
        insert_shape: step1Prompt.insert_shape,
        source_priority: step1Prompt.source_priority,
        evidence_threshold: step1Prompt.evidence_threshold,
        fallback_rule: step1Prompt.fallback_rule,
        insert_rule: sequence.step1.insert_rule,
      },
      step4: {
        subject: sequence.step4.subject,
        lookup: sequence.step4.lookup,
        prompt: step4Prompt.instruction,
        insert_shape: step4Prompt.insert_shape,
        source_priority: step4Prompt.source_priority,
        evidence_threshold: step4Prompt.evidence_threshold,
        fallback_rule: step4Prompt.fallback_rule,
      },
    },
    output_contract: {
      selected_insert: 'final sentence to place in email; omit when fallback_used is true',
      confidence: 'high / medium / low',
      evidence_type: evidenceTypes,
      verified_fact: 'exact public fact',
      inference_used: 'soft inference, if any',
      source_url: 'URL used for the insert',
      source_snippet: 'short excerpt',
      fallback_used: 'boolean',
    },
  };
}

function compactDossier(finding?: BdrResearchFinding) {
  const items = finding?.dossier?.items ?? [];
  if (items.length > 0) {
    return items.map((item) => ({
      source_url: item.source_url,
      source_title: item.source_title,
      source_kind: item.source_kind,
      confidence: item.confidence,
      verified_fact: item.verified_fact,
      source_snippet: item.snippet.slice(0, 240),
      inferred_operating_moment: item.inferred_operating_moment,
      repeated_pattern_group: item.repeated_pattern_group,
      qualified: item.qualified,
      disqualification_reason: item.disqualification_reason,
      ranking_rationale: item.ranking_rationale,
    }));
  }
  return finding?.insert?.source_url ? [{
    source_url: finding.insert.source_url,
    confidence: finding.insert.confidence,
    verified_fact: finding.insert.verified_fact,
    source_snippet: finding.insert.source_snippet,
    qualified: !finding.insert.fallback_used,
    ranking_rationale: finding.insert.qualification_rationale,
  }] : [];
}

export function bdrInsertSynthesisPrompt({
  company,
  sequence,
  research,
}: {
  company: CompanyInput;
  sequence: BdrSequenceTemplate;
  research: Omit<BdrResearchBundle, 'account'>;
}) {
  const [step1Prompt, step4Prompt] = bdrPromptPackSlices(sequence.code);
  return {
    prompt_pack_revision: BDR_PROMPT_PACK_REVISION,
    company: { company_name: company.company_name, domain: company.domain },
    sequence: {
      code: sequence.code,
      brand_label: sequence.brand_label,
      persona_label: sequence.persona_label,
      language_constraints: step1Prompt.language_constraints,
      step1: {
        subject: sequence.step1.subject,
        lookup: sequence.step1.lookup,
        prompt: bdrPromptPackSlice(sequence.code, 1).instruction,
        insert_shape: step1Prompt.insert_shape,
        evidence_threshold: step1Prompt.evidence_threshold,
        fallback_rule: step1Prompt.fallback_rule,
        current_deterministic_insert: research.step1.insert,
        compact_dossier: compactDossier(research.step1),
      },
      step4: {
        subject: sequence.step4.subject,
        lookup: sequence.step4.lookup,
        prompt: bdrPromptPackSlice(sequence.code, 4).instruction,
        insert_shape: step4Prompt.insert_shape,
        evidence_threshold: step4Prompt.evidence_threshold,
        fallback_rule: step4Prompt.fallback_rule,
        current_deterministic_insert: research.step4.insert,
        compact_dossier: compactDossier(research.step4),
      },
    },
    output_contract: {
      step1: 'exactly one insert object for Step 1, or fallback_used true',
      step4: 'exactly one insert object for Step 4, or fallback_used true',
      allowed_evidence_urls: {
        step1: [...allowedEvidenceUrls(research.step1)],
        step4: [...allowedEvidenceUrls(research.step4)],
      },
      constraints: [
        'Use only URLs present in the compact dossier.',
        'Do not write full email bodies.',
        'Do not include research-process language.',
        'Keep selected_insert as one sentence that fits the destination template.',
      ],
    },
  };
}

export async function researchBdrPlaceholdersWithAgent({
  company,
  sequence,
  research,
}: {
  company: CompanyInput;
  sequence: BdrSequenceTemplate;
  research: Omit<BdrResearchBundle, 'account'>;
}): Promise<{ step1: BdrResearchFinding; step4: BdrResearchFinding; warnings: string[] } | undefined> {
  if (!agentEnabled()) return undefined;
  const timeoutMs = intEnv('BDR_RESEARCH_AGENT_TIMEOUT_MS', 45000);
  const prompt = bdrInsertSynthesisPrompt({ company, sequence, research });

  const result = await withTimeout(generateText({
    model: anthropic(process.env.BDR_RESEARCH_AGENT_MODEL ?? 'claude-sonnet-4-5'),
    system: generalPrompt(),
    prompt: JSON.stringify(prompt),
    output: Output.object({ schema: placeholderOutputSchema }),
    temperature: 0,
    maxOutputTokens: 1400,
    experimental_telemetry: { isEnabled: true, functionId: 'bdr-insert-synthesis' },
  }), timeoutMs);
  const output = result.output as AgentPlaceholderOutput;
  return {
    step1: normalizeBdrSynthesisFinding({ lookup: sequence.step1.lookup, finding: research.step1, output: output.step1 }),
    step4: normalizeBdrSynthesisFinding({ lookup: sequence.step4.lookup, finding: research.step4, output: output.step4 }),
    warnings: output.warnings,
  };
}
