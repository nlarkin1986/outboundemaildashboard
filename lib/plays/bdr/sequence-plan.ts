import type { ResearchResult } from '@/lib/ai/tools';
import type { BatchContactInput, CompanyInput } from '@/lib/schemas';
import { selectBdrSequence } from './classify';
import { sequenceFor } from './sequences';
import type { BdrBrandClassification, BdrBrandTypeCode, BdrSequenceCode, BdrSequencePlan, BdrSequenceSelection } from './types';
import type { BdrResearchProvider } from './research';

const brandLabels: Record<BdrBrandTypeCode, string> = {
  A: 'High return rate',
  B: 'High consideration / high ticket',
  C: 'Subscription & replenishment',
};

const evidenceTerms: Record<BdrBrandTypeCode, string[]> = {
  A: ['footwear', 'shoe', 'sneaker', 'apparel', 'fashion', 'clothing', 'size', 'sizing', 'fit'],
  B: ['furniture', 'mattress', 'electronics', 'appliance', 'luxury', 'sofa', 'sectional', 'high ticket', 'customizable'],
  C: ['subscription', 'subscribed', 'replenishment', 'subscribe', 'autoship', 'membership', 'monthly', 'cancel', 'pause', 'supplement', 'vitamin', 'nutrition', 'daily pack', 'daily sachet', 'gummy', 'gummies'],
};

function contactKey(contact: BatchContactInput, index: number) {
  return contact.email?.toLowerCase() || `${contact.name ?? contact.first_name ?? 'contact'}:${index}`;
}

function evidenceText(results: ResearchResult[]) {
  return results.map((result) => `${result.source_title ?? ''} ${result.quote_or_fact}`).join(' ').toLowerCase();
}

function evidenceUrls(results: ResearchResult[]) {
  return results.map((result) => result.source_url).filter(Boolean).slice(0, 8);
}

function evidenceClaims(results: ResearchResult[]) {
  return results.map((result) => result.quote_or_fact.slice(0, 240)).filter(Boolean).slice(0, 4);
}

function evidenceBrand(results: ResearchResult[]): BdrBrandClassification | undefined {
  const text = evidenceText(results);
  const scores = (Object.keys(evidenceTerms) as BdrBrandTypeCode[])
    .map((code) => ({
      code,
      score: evidenceTerms[code].filter((term) => text.includes(term)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (a.code === 'C' ? -1 : b.code === 'C' ? 1 : 0));
  const winner = scores[0];
  if (winner) {
    return {
      code: winner.code,
      label: brandLabels[winner.code],
      reason: 'Public account research matched supported BDR brand category terms.',
      confidence: 'medium',
    };
  }
  return undefined;
}

function strengthenSelection(selection: BdrSequenceSelection, accountResearch: ResearchResult[]): BdrSequenceSelection {
  if (selection.brand.code) return selection;
  const brand = evidenceBrand(accountResearch);
  if (!brand || !selection.persona.code) return selection;
  const sequence_code = selection.persona.code === 'D'
    ? (`D-${brand.code === 'A' ? 1 : brand.code === 'B' ? 2 : 3}` as BdrSequenceCode)
    : (`${brand.code}-${selection.persona.code}` as BdrSequenceCode);
  return {
    brand,
    persona: selection.persona,
    sequence_code,
    warnings: selection.warnings.filter((warning) => !/brand/i.test(warning)),
  };
}

function confidenceFor(selection: BdrSequenceSelection, accountResearch: ResearchResult[]) {
  if (!selection.sequence_code) return 'low' as const;
  const hasPublicEvidence = accountResearch.some((result) => result.evidence_type === 'public_fact' && result.confidence !== 'low');
  if (selection.brand.confidence === 'medium' && hasPublicEvidence && selection.warnings.length === 0) return 'high' as const;
  return selection.warnings.length ? 'medium' as const : selection.brand.confidence;
}

export async function createBdrSequencePlans({
  company,
  contacts,
  researchProvider,
}: {
  company: CompanyInput;
  contacts: BatchContactInput[];
  researchProvider: Pick<BdrResearchProvider, 'accountResearch'>;
}): Promise<{ accountResearch: ResearchResult[]; plans: BdrSequencePlan[] }> {
  const accountResearch = await researchProvider.accountResearch(company);
  const urls = evidenceUrls(accountResearch);
  const claims = evidenceClaims(accountResearch);
  const plans = contacts.map((contact, index) => {
    const selection = strengthenSelection(selectBdrSequence(company, contact.title), accountResearch);
    const required_lookups = selection.sequence_code
      ? [sequenceFor(selection.sequence_code).step1.lookup, sequenceFor(selection.sequence_code).step4.lookup]
      : [];
    return {
      contact_key: contactKey(contact, index),
      sequence: selection,
      sequence_code: selection.sequence_code,
      confidence: confidenceFor(selection, accountResearch),
      required_lookups,
      evidence_urls: urls,
      evidence_claims: claims,
      warnings: selection.warnings,
    };
  });
  return { accountResearch, plans };
}

export function bdrContactKey(contact: BatchContactInput, index: number) {
  return contactKey(contact, index);
}
