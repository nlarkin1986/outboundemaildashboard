import { extractWithBrowserbase } from '@/lib/ai/browserbase';
import { scrapeWithFirecrawl, searchPublicWeb, searchWithExa, type ResearchResult } from '@/lib/ai/tools';
import type { CompanyInput } from '@/lib/schemas';
import type { BdrEvidenceType, BdrPersonalizationInsert, BdrSequenceTemplate } from './types';
import { buildBdrEvidenceDossier, researchFindingFromDossier, type BdrEvidenceDossier } from './research-dossier';

export type BdrResearchFinding = {
  value?: string;
  insert?: BdrPersonalizationInsert;
  evidence_urls: string[];
  warning?: string;
  dossier?: BdrEvidenceDossier;
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
  extraWarnings: string[] = [],
): BdrResearchFinding {
  const dossier = buildBdrEvidenceDossier({ lookup, company, results, fallbackWarning });
  const finding = researchFindingFromDossier({ company, dossier, fallbackWarning });
  const warnings = [...extraWarnings, finding.warning].filter(Boolean) as string[];
  const withDossier = { ...finding, dossier };
  return warnings.length > 0 ? { ...withDossier, warning: [...new Set(warnings)].join(' ') } : withDossier;
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

function intEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function promisingStaticUrl(lookup: BdrSequenceTemplate['step1']['lookup'] | BdrSequenceTemplate['step4']['lookup'], result: ResearchResult, company: CompanyInput) {
  const text = `${result.source_title ?? ''} ${result.source_url} ${result.quote_or_fact}`.toLowerCase();
  const domain = company.domain?.replace(/^www\./i, '').toLowerCase();
  const hostMatches = domain ? result.source_url.toLowerCase().includes(domain) : true;
  if (lookup === 'review_pattern') return /trustpilot|reddit|review|complaint/.test(text);
  if (lookup === 'support_jobs') return /careers?|jobs?|greenhouse|lever|ashby|customer|support|care|cx/.test(text);
  if (lookup === 'subscription_signal') return hostMatches && /subscription|subscribe|recurring|autoship|membership|cancel|pause|skip|portal|account/.test(text);
  if (lookup === 'hero_product' || lookup === 'complex_product') return hostMatches && /product|collection|catalog|shop|pdp|sizing|fit|warranty|delivery/.test(text);
  return /press|news|careers?|jobs?|digital|commerce|platform|partnership|replatform|omnichannel/.test(text);
}

async function enrichStaticEvidence({
  lookup,
  company,
  results,
}: {
  lookup: BdrSequenceTemplate['step1']['lookup'] | BdrSequenceTemplate['step4']['lookup'];
  company: CompanyInput;
  results: ResearchResult[];
}) {
  const maxExtractions = intEnv('BDR_RESEARCH_STATIC_EXTRACT_MAX', 1);
  const timeoutMs = intEnv('BDR_RESEARCH_FIRECRAWL_TIMEOUT_MS', 12000);
  const candidates = results
    .filter((result) => result.source_url)
    .filter((result) => promisingStaticUrl(lookup, result, company))
    .slice(0, maxExtractions);
  const extracted: ResearchResult[] = [];
  const warnings: string[] = [];

  for (const candidate of candidates) {
    const scraped = await scrapeWithFirecrawl(candidate.source_url, { timeoutMs });
    if (scraped.length > 0) {
      extracted.push(...scraped.map((result) => ({ ...result, confidence: result.confidence === 'low' ? 'low' as const : 'high' as const })));
      continue;
    }
    if (process.env.BDR_RESEARCH_BROWSERBASE_FALLBACK === 'true') {
      const browserbase = await extractWithBrowserbase(candidate.source_url);
      extracted.push(...browserbase.results);
      if (browserbase.warning) warnings.push(browserbase.warning);
    }
  }

  const shouldPreferExtractedOnly = extracted.length > 0 && lookup !== 'review_pattern' && lookup !== 'support_jobs';
  return { results: shouldPreferExtractedOnly ? extracted : [...extracted, ...results], warnings };
}

async function lookupSearch({
  company,
  lookup,
  queries,
  fallbackWarning,
  numResults,
}: {
  company: CompanyInput;
  lookup: BdrSequenceTemplate['step1']['lookup'] | BdrSequenceTemplate['step4']['lookup'];
  queries: Array<{ query: string; domain?: string }>;
  fallbackWarning: string;
  numResults: number;
}) {
  const resultSets = await Promise.all(queries.map((query) => searchPublicWeb(query.query, query.domain, numResults)));
  const searched = resultSets.flat();
  const enriched = await enrichStaticEvidence({ lookup, company, results: searched });
  return firstUseful(enriched.results, fallbackWarning, lookup, company, enriched.warnings);
}

export const defaultBdrResearchProvider: BdrResearchProvider = {
  accountResearch: (company) => searchWithExa(company.company_name, company.domain),
  async heroProduct(company) {
    return lookupSearch({
      company,
      lookup: 'hero_product',
      fallbackWarning: 'No current product or collection push found; used Step 1 fallback.',
      numResults: 3,
      queries: [
        { query: `${company.company_name} current product collection launch sizing fit`, domain: company.domain },
        { query: `${company.company_name} best sellers product collection catalog`, domain: company.domain },
      ],
    });
  },
  async complexProduct(company) {
    return lookupSearch({
      company,
      lookup: 'complex_product',
      fallbackWarning: 'No complex/high-ticket product found; used category-level fallback.',
      numResults: 3,
      queries: [
        { query: `${company.company_name} customizable high ticket product warranty delivery catalog`, domain: company.domain },
        { query: `${company.company_name} complex product expert guidance buying guide`, domain: company.domain },
      ],
    });
  },
  async digitalSignal(company) {
    return lookupSearch({
      company,
      lookup: 'digital_signal',
      fallbackWarning: 'No digital investment signal found; used generic digital Step 1 fallback.',
      numResults: 3,
      queries: [
        { query: `${company.company_name} digital commerce replatform omnichannel technology partnership modernization`, domain: undefined },
        { query: `${company.company_name} ecommerce data AI customer experience hiring`, domain: undefined },
      ],
    });
  },
  async subscriptionSignal(company) {
    return lookupSearch({
      company,
      lookup: 'subscription_signal',
      fallbackWarning: 'No subscription signal found; used generic subscription Step 1 fallback.',
      numResults: 3,
      queries: [
        { query: `${company.company_name} subscription cancel pause skip manage recurring membership`, domain: company.domain },
        { query: `${company.company_name} subscription portal autoship replenishment help`, domain: company.domain },
      ],
    });
  },
  async reviewPattern(company) {
    return lookupSearch({
      company,
      lookup: 'review_pattern',
      fallbackWarning: 'No repeated review pattern found; used Step 4 Version B.',
      numResults: 4,
      queries: [
        { query: `${company.company_name} reviews Trustpilot Reddit complaints sizing fit returns support cancel`, domain: undefined },
        { query: `${company.company_name} customer reviews support shipping returns subscription complaints`, domain: undefined },
      ],
    });
  },
  async supportJobs(company) {
    const first = await lookupSearch({
      company,
      lookup: 'support_jobs',
      fallbackWarning: 'No support role count found; used Step 4 Version B.',
      numResults: 3,
      queries: [
        { query: `${company.company_name} careers customer support customer care CX operations jobs`, domain: company.domain },
        { query: `${company.company_name} LinkedIn jobs customer support CX customer service roles`, domain: undefined },
      ],
    });
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
  const step1Promise = sequence.step1.lookup === 'hero_product'
    ? provider.heroProduct(company)
    : sequence.step1.lookup === 'complex_product'
      ? provider.complexProduct(company)
      : sequence.step1.lookup === 'subscription_signal'
        ? provider.subscriptionSignal(company)
        : provider.digitalSignal(company);
  const step4Promise = sequence.step4.lookup === 'support_jobs'
    ? provider.supportJobs(company)
    : sequence.step4.lookup === 'digital_investment'
      ? provider.digitalSignal(company)
      : provider.reviewPattern(company);
  const [step1, step4] = await Promise.all([step1Promise, step4Promise]);
  return { step1, step4 };
}
