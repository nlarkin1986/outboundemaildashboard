import type { CompanyInput } from '@/lib/schemas';
import type { BdrBrandClassification, BdrBrandTypeCode, BdrPersonaClassification, BdrPersonaCode, BdrSequenceCode, BdrSequenceSelection } from './types';

const brandLabels: Record<BdrBrandTypeCode, string> = {
  A: 'High return rate',
  B: 'High consideration / high ticket',
  C: 'Subscription & replenishment',
};

const personaLabels: Record<BdrPersonaCode, string> = {
  '1': 'VP / Director of CX',
  '2': 'Head of Support / Support Ops',
  '3': 'CIO / CDO / VP Digital Transformation',
  D: 'eCommerce Leader',
};

const highReturnTerms = ['footwear', 'shoe', 'shoes', 'sneaker', 'sneakers', 'apparel', 'athletic', 'swimwear', 'lingerie', 'children', 'kids', 'baby', 'fashion', 'clothing', 'kizik', 'rothy', 'allbirds'];
const highConsiderationTerms = ['furniture', 'mattress', 'electronics', 'appliance', 'luxury', 'sofa', 'sectional', 'home theater', 'computer', 'audio', 'tv', 'lg', 'samsung', 'sonos'];
const subscriptionTerms = ['subscription', 'subscribed', 'replenishment', 'supplement', 'vitamin', 'nutrition', 'daily pack', 'daily sachet', 'gummy', 'gummies', 'pet food', 'meal kit', 'beauty subscription', 'personal care', 'subscribe', 'autoship'];
const unsupportedTerms = ['bank', 'insurance', 'telecom', 'airline', 'hotel', 'media', 'software', 'saas', 'b2b', 'finance', 'travel'];

function normalizedText(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ').toLowerCase();
}

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function classifyBrand(company: CompanyInput): BdrBrandClassification {
  const text = normalizedText(company.company_name, company.domain);
  if (containsAny(text, unsupportedTerms)) {
    return {
      reason: 'Company signals do not fit the retail/ecommerce/DTC categories supported by the BDR play.',
      confidence: 'low',
      warning: 'Unsupported brand category; confirm closest-fit before writing outreach.',
    };
  }
  if (containsAny(text, subscriptionTerms)) {
    return { code: 'C', label: brandLabels.C, reason: 'Company/category signals match subscription or replenishment commerce.', confidence: 'medium' };
  }
  if (containsAny(text, highReturnTerms)) {
    return { code: 'A', label: brandLabels.A, reason: 'Company/category signals match high-return retail.', confidence: 'medium' };
  }
  if (containsAny(text, highConsiderationTerms)) {
    return { code: 'B', label: brandLabels.B, reason: 'Company/category signals match high-consideration or high-ticket retail.', confidence: 'medium' };
  }
  return {
    reason: 'No supported BDR brand category could be inferred from the supplied company name/domain.',
    confidence: 'low',
    warning: 'Brand type needs confirmation before this BDR play can be trusted.',
  };
}

export function classifyPersona(title?: string): BdrPersonaClassification {
  const text = normalizedText(title);
  if (!text) return { reason: 'No title was supplied.', warning: 'Contact title is required for BDR sequence mapping.' };
  if (/e-?commerce|digital commerce|commerce|retail operations/.test(text)) return { code: 'D', label: personaLabels.D, reason: 'Title maps to eCommerce or retail operations leadership.' };
  if (/\b(cio|cto)\b|chief digital|chief information|chief technology|digital transformation|\bvp of it\b|head of digital transformation/.test(text)) return { code: '3', label: personaLabels['3'], reason: 'Title maps to digital/technology transformation leadership.' };
  if (/customer experience|customer service|\bcx\b/.test(text) && /(vp|vice president|director|head)/.test(text)) return { code: '1', label: personaLabels['1'], reason: 'Title maps to VP/Director customer experience leadership.' };
  if (/customer experience|\bcx\b/.test(text)) return { code: '1', label: personaLabels['1'], reason: 'Headline references customer experience leadership.', warning: 'Customer experience headline did not include formal seniority; verify title before push.' };
  if (/support|customer support|support operations|customer care/.test(text)) return { code: '2', label: personaLabels['2'], reason: 'Title maps to support/support operations leadership.' };
  if (/vp of digital|digital director|chief.*digital/.test(text)) return { code: '3', label: personaLabels['3'], reason: 'Ambiguous digital title defaults to persona 3.', warning: 'Digital title did not explicitly mention transformation or eCommerce; sanity-check persona 3.' };
  return { reason: `Title "${title}" does not map to a supported BDR persona.`, warning: 'Unsupported persona; skip or write custom outreach.' };
}

export function selectBdrSequence(company: CompanyInput, title?: string): BdrSequenceSelection {
  const brand = classifyBrand(company);
  const persona = classifyPersona(title);
  const warnings = [brand.warning, persona.warning].filter(Boolean) as string[];
  if (!brand.code || !persona.code) return { brand, persona, warnings };
  const sequence_code: BdrSequenceCode = persona.code === 'D'
    ? (`D-${brand.code === 'A' ? 1 : brand.code === 'B' ? 2 : 3}` as BdrSequenceCode)
    : (`${brand.code}-${persona.code}` as BdrSequenceCode);
  return { brand, persona, sequence_code, warnings };
}
