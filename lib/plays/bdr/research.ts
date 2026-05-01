import { searchPublicWeb, searchWithExa, type ResearchResult } from '@/lib/ai/tools';
import type { CompanyInput } from '@/lib/schemas';
import type { BdrEvidenceType, BdrPersonalizationInsert, BdrSequenceTemplate } from './types';
import { sanitizeBdrPersonalizationValue } from './personalization';

export type BdrResearchFinding = {
  value?: string;
  insert?: BdrPersonalizationInsert;
  evidence_urls: string[];
  warning?: string;
};

export type BdrResearchBundle = {
  account: ResearchResult[];
  step1: BdrResearchFinding;
  step4: BdrResearchFinding;
};

export type BdrResearchProvider = {
  accountResearch(company: CompanyInput): Promise<ResearchResult[]>;
  heroProduct(company: CompanyInput): Promise<BdrResearchFinding>;
  complexProduct(company: CompanyInput): Promise<BdrResearchFinding>;
  digitalSignal(company: CompanyInput): Promise<BdrResearchFinding>;
  subscriptionSignal(company: CompanyInput): Promise<BdrResearchFinding>;
  reviewPattern(company: CompanyInput): Promise<BdrResearchFinding>;
  supportJobs(company: CompanyInput): Promise<BdrResearchFinding>;
};

function firstUseful(
  results: ResearchResult[],
  fallbackWarning: string,
  lookup: BdrSequenceTemplate['step1']['lookup'] | BdrSequenceTemplate['step4']['lookup'],
  company: CompanyInput,
): BdrResearchFinding {
  const first = results[0];
  if (!first) return { evidence_urls: [], warning: fallbackWarning, insert: fallbackInsert(fallbackWarning, 'inference') };
  const rawValue = `${first.source_title ?? ''} ${first.quote_or_fact}`;
  const value = sanitizeBdrPersonalizationValue({ value: rawValue, lookup, companyName: company.company_name });
  const evidenceUrls = results.map((result) => result.source_url).filter(Boolean);
  if (!value) return { evidence_urls: evidenceUrls, warning: fallbackWarning, insert: fallbackInsert(fallbackWarning, evidenceTypeForLookup(lookup), first) };
  const insert: BdrPersonalizationInsert = {
    selected_insert: value,
    confidence: confidenceForFinding(first),
    evidence_type: evidenceTypeForLookup(lookup),
    verified_fact: first.quote_or_fact,
    inference_used: inferenceForLookup(lookup, value),
    source_url: first.source_url,
    source_snippet: first.quote_or_fact.slice(0, 240),
    fallback_used: false,
  };
  return {
    value,
    insert,
    evidence_urls: evidenceUrls,
  };
}

function fallbackInsert(warning: string, evidenceType: BdrEvidenceType, result?: ResearchResult): BdrPersonalizationInsert {
  return {
    confidence: 'low',
    evidence_type: evidenceType,
    verified_fact: result?.quote_or_fact,
    source_url: result?.source_url,
    source_snippet: result?.quote_or_fact.slice(0, 240),
    fallback_used: true,
    warning,
  };
}

function confidenceForFinding(result: ResearchResult) {
  if (result.confidence === 'high') return 'high' as const;
  if (result.confidence === 'medium' && result.evidence_type === 'public_fact') return 'medium' as const;
  return 'low' as const;
}

function evidenceTypeForLookup(lookup: BdrSequenceTemplate['step1']['lookup'] | BdrSequenceTemplate['step4']['lookup']): BdrEvidenceType {
  if (lookup === 'hero_product' || lookup === 'complex_product') return 'product';
  if (lookup === 'support_jobs') return 'jobs';
  if (lookup === 'review_pattern') return 'reviews';
  if (lookup === 'digital_signal' || lookup === 'digital_investment') return 'press';
  if (lookup === 'subscription_signal') return 'help_center';
  return 'inference';
}

function inferenceForLookup(lookup: BdrSequenceTemplate['step1']['lookup'] | BdrSequenceTemplate['step4']['lookup'], value: string) {
  if (lookup === 'hero_product') return `${value} can create fit, sizing, return, gift-timing, or pre-purchase question volume.`;
  if (lookup === 'complex_product') return `${value} can create pre-purchase decision complexity.`;
  if (lookup === 'subscription_signal') return `${value} can create save, cancel, or subscriber lifecycle moments.`;
  if (lookup === 'review_pattern') return `${value} can indicate a repeated customer friction pattern.`;
  if (lookup === 'support_jobs') return `${value} can indicate active ownership of support, routing, or retention operations.`;
  return `${value} can indicate roadmap sequencing relevance.`;
}

export const defaultBdrResearchProvider: BdrResearchProvider = {
  accountResearch: (company) => searchWithExa(company.company_name, company.domain),
  async heroProduct(company) {
    return firstUseful(await searchPublicWeb(`${company.company_name} current collection product launch homepage Instagram TikTok`, company.domain, 3), 'No current product or collection push found; used Step 1 fallback.', 'hero_product', company);
  },
  async complexProduct(company) {
    return firstUseful(await searchPublicWeb(`${company.company_name} most expensive customizable complex product catalog`, company.domain, 3), 'No complex/high-ticket product found; used category-level fallback.', 'complex_product', company);
  },
  async digitalSignal(company) {
    return firstUseful(await searchPublicWeb(`${company.company_name} digital transformation replatforming technology partnership modernization`, undefined, 3), 'No digital investment signal found; used generic digital Step 1 fallback.', 'digital_signal', company);
  },
  async subscriptionSignal(company) {
    return firstUseful(await searchPublicWeb(`${company.company_name} subscription replenishment subscribe autoship membership`, company.domain, 3), 'No subscription signal found; used generic subscription Step 1 fallback.', 'subscription_signal', company);
  },
  async reviewPattern(company) {
    return firstUseful(await searchPublicWeb(`${company.company_name} reviews Trustpilot Google Reddit complaints support sizing cancel slow response`, undefined, 4), 'No repeated review pattern found; used Step 4 Version B.', 'review_pattern', company);
  },
  async supportJobs(company) {
    const results = await searchPublicWeb(`${company.company_name} LinkedIn jobs customer support CX customer service roles`, undefined, 3);
    const first = firstUseful(results, 'No support role count found; used Step 4 Version B.', 'support_jobs', company);
    const match = first.value?.match(/\b([2-9]|[1-9][0-9]+)\b/);
    return match
      ? { ...first, value: match[1] }
      : { evidence_urls: first.evidence_urls, warning: 'No support role count found; used Step 4 Version B.', insert: fallbackInsert('No support role count found; used Step 4 Version B.', 'jobs') };
  },
};

export async function researchForBdrSequence(company: CompanyInput, sequence: BdrSequenceTemplate, provider: BdrResearchProvider = defaultBdrResearchProvider): Promise<BdrResearchBundle> {
  const account = await provider.accountResearch(company);
  const placeholders = await researchPlaceholdersForBdrSequence(company, sequence, provider);
  return { account, ...placeholders };
}

export async function researchPlaceholdersForBdrSequence(company: CompanyInput, sequence: BdrSequenceTemplate, provider: BdrResearchProvider = defaultBdrResearchProvider): Promise<Omit<BdrResearchBundle, 'account'>> {
  const step1 = sequence.step1.lookup === 'hero_product'
    ? await provider.heroProduct(company)
    : sequence.step1.lookup === 'complex_product'
      ? await provider.complexProduct(company)
      : sequence.step1.lookup === 'subscription_signal'
        ? await provider.subscriptionSignal(company)
        : await provider.digitalSignal(company);
  const step4 = sequence.step4.lookup === 'support_jobs'
    ? await provider.supportJobs(company)
    : sequence.step4.lookup === 'digital_investment'
      ? await provider.digitalSignal(company)
      : await provider.reviewPattern(company);
  return { step1, step4 };
}
