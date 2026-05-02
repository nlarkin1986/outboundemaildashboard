import type { BdrLookupKey } from './types';

const pageChromePatterns = [
  /skip to main content/gi,
  /go to [a-z0-9_/-]+/gi,
  /best sellers/gi,
  /high quality essentials, radically low prices/gi,
];

function compact(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripChrome(value: string) {
  let output = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#*_`[\]]+/g, ' ')
    .replace(/\|\s*LinkedIn\b/gi, ' ')
    .replace(/\bfrom\s+\$[\d,.]+|\$[\d,.]+/gi, ' ')
    .replace(/\b\d(?:\.\d)?\s*\+\d*\b/g, ' ');

  for (const pattern of pageChromePatterns) output = output.replace(pattern, ' ');
  return compact(output);
}

function categoryForProduct(title: string) {
  const text = title.toLowerCase();
  if (/cashmere/.test(text) && /sweater|cardigan|crew|pullover|hoodie/.test(text)) return 'cashmere sweaters';
  if (/linen/.test(text) && /sheet|duvet|bedding|quilt/.test(text)) return 'linen bedding';
  if (/silk/.test(text) && /dress|shirt|skirt|pajama|robe|collection/.test(text)) return 'washable silk';
  if (/sneaker|shoe|footwear/.test(text)) return title.replace(/\s+/g, ' ').trim();
  return title
    .replace(/\b(Mongolian|European|Organic|Premium|Classic|Essential)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function joinNatural(items: string[]) {
  const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  if (unique.length === 0) return undefined;
  if (unique.length === 1) return unique[0];
  return `${unique.slice(0, -1).join(', ')} and ${unique.at(-1)}`;
}

function productPhrase(value: string) {
  const headings = [...value.matchAll(/##\s+([^#\n]+?)(?=\s+(?:from\s+)?\$|\s+\d(?:\.\d)?\b|\s+##|$)/gi)]
    .map((match) => stripChrome(match[1]))
    .map((text) => text.replace(/\s+-\s+bundle.*$/i, '').trim())
    .filter((text) => text.length > 4 && !/best sellers|shop all|view all/i.test(text))
    .slice(0, 2);

  if (headings.length > 0) return joinNatural(headings.map(categoryForProduct));

  const cleaned = stripChrome(value)
    .replace(/^[A-Z][A-Za-z0-9 .&'-]+\s+\|\s+/i, '')
    .replace(/\s+[-–—]\s+.*/g, '')
    .trim();
  const productTitle = cleaned.match(/^(.{4,90}?\b(?:sneaker|shoe|footwear|boot|sandal|sweater|cardigan|dress|shirt|sofa|sectional|mattress|table|chair|warranty|bundle|collection|sheet set)\b)/i)?.[1];
  if (productTitle) return categoryForProduct(productTitle.trim());
  const product = categoryForProduct(cleaned);
  return product.length <= 90 ? product : undefined;
}

function reviewPhrase(value: string, companyName: string) {
  const text = stripChrome(value).toLowerCase();
  const themes: string[] = [];
  if (/\bfit|sizing|size\b/.test(text)) themes.push('fit and sizing questions');
  if (/return|refund|exchange/.test(text)) themes.push('return or exchange friction');
  if (/shipping|delivery|late|delay/.test(text)) themes.push('shipping delays');
  if (/quality|defect|damaged|poorly made/.test(text)) themes.push('quality concerns');
  if (/support|service|response|chat|email/.test(text)) themes.push('support responsiveness');
  if (/scam|trust|fake|chargeback/.test(text)) themes.push('trust concerns');
  if (/cancel|subscription|pause/.test(text)) themes.push('subscription-change friction');

  const uniqueThemes = [...new Set(themes)].slice(0, 2);
  if (uniqueThemes.length === 0) return undefined;
  return `customers mention ${uniqueThemes.join(' and ')} in public reviews`;
}

function signalPhrase(value: string, lookup: BdrLookupKey) {
  const cleaned = stripChrome(value);
  const text = cleaned.toLowerCase();
  if (lookup === 'subscription_signal') {
    if (/daily/.test(text) && /nutrition|supplement|vitamin|gumm/.test(text)) return 'a daily nutrition subscription';
    if (/upgrade/.test(text) && /subscription/.test(text)) return 'a subscription upgrade flow';
    if (/subscribe|subscription|member/.test(text)) return 'a subscription buying path';
  }
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim();
  if (!firstSentence) return undefined;
  return firstSentence.length <= 120 ? firstSentence : `${firstSentence.slice(0, 117).trim()}...`;
}

function insertForLookup(lookup: BdrLookupKey, phrase: string, companyName: string) {
  if (lookup === 'hero_product') {
    return `${companyName}'s ${phrase} can put fit, sizing, or product-comparison questions in the buying moment`;
  }
  if (lookup === 'complex_product') {
    return `${phrase} on the ${companyName} site looks like the kind of purchase where customers need a real answer before they buy`;
  }
  if (lookup === 'subscription_signal') {
    return `The ${phrase.replace(/^a\s+/i, '')} at ${companyName} makes the save/cancel moment look like a revenue workflow, not just a support workflow`;
  }
  if (lookup === 'digital_signal' || lookup === 'digital_investment') {
    return `Given ${phrase}, the sequencing question is probably where customer continuity fits into the roadmap`;
  }
  if (lookup === 'support_jobs') {
    return `${companyName} is hiring around ${phrase}, which usually means routing or coverage is active enough to have an owner`;
  }
  return phrase;
}

export function sanitizeBdrPersonalizationValue({
  value,
  lookup,
  companyName,
}: {
  value?: string;
  lookup: BdrLookupKey;
  companyName: string;
}) {
  if (!value) return undefined;

  const phrase = lookup === 'hero_product' || lookup === 'complex_product'
    ? productPhrase(value)
    : lookup === 'review_pattern'
      ? reviewPhrase(value, companyName)
      : signalPhrase(value, lookup);

  if (!phrase) return undefined;
  if (lookup === 'review_pattern') return phrase;
  return insertForLookup(lookup, phrase, companyName);
}
