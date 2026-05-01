import type { CompanyInput } from '@/lib/schemas';
import { researchPlaceholdersForBdrSequence, type BdrResearchProvider } from './research';
import { sanitizeBdrPersonalizationValue } from './personalization';
import { sequenceFor } from './sequences';
import type { BdrLookupKey, BdrPersonalizationInsert, BdrPlaceholderResearch, BdrSequencePlan } from './types';

function normalizedInsert({
  value,
  insert,
  warning,
  evidenceUrls,
  lookup,
  company,
}: {
  value?: string;
  insert?: BdrPersonalizationInsert;
  warning?: string;
  evidenceUrls: string[];
  lookup: BdrLookupKey;
  company: CompanyInput;
}) {
  if (insert) return insert;
  const selected = sanitizeBdrPersonalizationValue({ value, lookup, companyName: company.company_name });
  if (selected) {
    return {
      selected_insert: selected,
      confidence: 'medium' as const,
      evidence_type: lookup === 'review_pattern' ? 'reviews' as const : 'inference' as const,
      verified_fact: value,
      source_url: evidenceUrls[0],
      source_snippet: value?.slice(0, 240),
      fallback_used: false,
    };
  }
  if (!warning) return undefined;
  return {
    confidence: 'low' as const,
    evidence_type: lookup === 'review_pattern' ? 'reviews' as const : 'inference' as const,
    verified_fact: value,
    source_url: evidenceUrls[0],
    source_snippet: value?.slice(0, 240),
    fallback_used: true,
    warning,
  };
}

export async function researchBdrPlaceholders({
  company,
  plan,
  researchProvider,
}: {
  company: CompanyInput;
  plan: BdrSequencePlan;
  researchProvider: BdrResearchProvider;
}): Promise<BdrPlaceholderResearch | undefined> {
  if (!plan.sequence_code) return undefined;
  const sequence = sequenceFor(plan.sequence_code);
  const research = await researchPlaceholdersForBdrSequence(company, sequence, researchProvider);
  const warnings = [research.step1.warning, research.step4.warning].filter(Boolean) as string[];

  return {
    sequence_code: plan.sequence_code,
    step1: {
      lookup: sequence.step1.lookup,
      value: research.step1.value,
      insert: normalizedInsert({ value: research.step1.value, insert: research.step1.insert, warning: research.step1.warning, evidenceUrls: research.step1.evidence_urls, lookup: sequence.step1.lookup, company }),
      evidence_urls: research.step1.evidence_urls,
      warning: research.step1.warning,
    },
    step4: {
      lookup: sequence.step4.lookup,
      value: research.step4.value,
      insert: normalizedInsert({ value: research.step4.value, insert: research.step4.insert, warning: research.step4.warning, evidenceUrls: research.step4.evidence_urls, lookup: sequence.step4.lookup, company }),
      evidence_urls: research.step4.evidence_urls,
      warning: research.step4.warning,
    },
    account_evidence_urls: plan.evidence_urls,
    account_evidence_claims: plan.evidence_claims,
    warnings,
  };
}
