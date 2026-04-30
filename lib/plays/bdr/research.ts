import { searchPublicWeb, searchWithExa, type ResearchResult } from '@/lib/ai/tools';
import type { CompanyInput } from '@/lib/schemas';
import type { BdrSequenceTemplate } from './types';

export type BdrResearchFinding = {
  value?: string;
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

function firstUseful(results: ResearchResult[], fallbackWarning: string): BdrResearchFinding {
  const first = results[0];
  if (!first) return { evidence_urls: [], warning: fallbackWarning };
  return {
    value: first.quote_or_fact.slice(0, 180),
    evidence_urls: results.map((result) => result.source_url).filter(Boolean),
  };
}

export const defaultBdrResearchProvider: BdrResearchProvider = {
  accountResearch: (company) => searchWithExa(company.company_name, company.domain),
  async heroProduct(company) {
    return firstUseful(await searchPublicWeb(`${company.company_name} current collection product launch homepage Instagram TikTok`, company.domain, 3), 'No current product or collection push found; used Step 1 fallback.');
  },
  async complexProduct(company) {
    return firstUseful(await searchPublicWeb(`${company.company_name} most expensive customizable complex product catalog`, company.domain, 3), 'No complex/high-ticket product found; used category-level fallback.');
  },
  async digitalSignal(company) {
    return firstUseful(await searchPublicWeb(`${company.company_name} digital transformation replatforming technology partnership modernization`, undefined, 3), 'No digital investment signal found; used generic digital Step 1 fallback.');
  },
  async subscriptionSignal(company) {
    return firstUseful(await searchPublicWeb(`${company.company_name} subscription replenishment subscribe autoship membership`, company.domain, 3), 'No subscription signal found; used generic subscription Step 1 fallback.');
  },
  async reviewPattern(company) {
    return firstUseful(await searchPublicWeb(`${company.company_name} reviews Trustpilot Google Reddit complaints support sizing cancel slow response`, undefined, 4), 'No repeated review pattern found; used Step 4 Version B.');
  },
  async supportJobs(company) {
    const results = await searchPublicWeb(`${company.company_name} LinkedIn jobs customer support CX customer service roles`, undefined, 3);
    const first = firstUseful(results, 'No support role count found; used Step 4 Version B.');
    const match = first.value?.match(/\b([2-9]|[1-9][0-9]+)\b/);
    return match
      ? { ...first, value: match[1] }
      : { evidence_urls: first.evidence_urls, warning: 'No support role count found; used Step 4 Version B.' };
  },
};

export async function researchForBdrSequence(company: CompanyInput, sequence: BdrSequenceTemplate, provider: BdrResearchProvider = defaultBdrResearchProvider): Promise<BdrResearchBundle> {
  const account = await provider.accountResearch(company);
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
  return { account, step1, step4 };
}
