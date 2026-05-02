import type { ResearchResult } from '@/lib/ai/tools';
import type { CompanyInput } from '@/lib/schemas';
import { bdrPromptConfigForLookup, type BdrPromptSource } from './prompt-pack';
import { sanitizeBdrPersonalizationValue } from './personalization';
import type { BdrEvidenceType, BdrFallbackCause, BdrLookupKey, BdrPersonalizationInsert } from './types';

export type BdrEvidenceDossierItem = {
  lookup: BdrLookupKey;
  source_url: string;
  source_title?: string;
  source_kind: BdrPromptSource;
  source_priority: number;
  snippet: string;
  evidence_type: BdrEvidenceType;
  confidence: 'high' | 'medium' | 'low';
  domain_match: boolean;
  specificity: 'high' | 'medium' | 'low';
  verified_fact: string;
  inferred_operating_moment: string;
  repeated_pattern_group?: string;
  qualified: boolean;
  disqualification_reason?: string;
  ranking_rationale: string;
};

export type BdrEvidenceDossier = {
  lookup: BdrLookupKey;
  items: BdrEvidenceDossierItem[];
  warnings: string[];
  fallback_cause?: BdrFallbackCause;
};

function compact(value?: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function sourceKindFor(result: ResearchResult): BdrPromptSource {
  const haystack = `${result.source_title ?? ''} ${result.source_url} ${result.quote_or_fact}`.toLowerCase();
  if (/trustpilot|reddit|reviews?|app store|google\.com\/search|complaints?/.test(haystack)) return 'reviews';
  if (/instagram|tiktok|facebook|x\.com|twitter/.test(haystack)) return 'social';
  if (/greenhouse|lever|ashby|linkedin|careers?|jobs?/.test(haystack)) return 'careers';
  if (/press|investor|news|funding|replatform|omnichannel|cto|cdo|digital/.test(haystack)) return 'press';
  if (/help|support|faq|returns?|shipping|cancel|subscription|subscribe|recurring|autoship|membership|pause|skip|policy/.test(haystack)) return 'help_center';
  if (/product|collection|catalog|shop|pdp|warranty|delivery|financing/.test(haystack)) return 'product_pages';
  return 'official_site';
}

function evidenceTypeForLookup(lookup: BdrLookupKey): BdrEvidenceType {
  if (lookup === 'hero_product' || lookup === 'complex_product') return 'product';
  if (lookup === 'support_jobs') return 'jobs';
  if (lookup === 'review_pattern') return 'reviews';
  if (lookup === 'digital_signal' || lookup === 'digital_investment') return 'press';
  if (lookup === 'subscription_signal') return 'help_center';
  return 'inference';
}

function confidenceFor(result: ResearchResult) {
  if (result.confidence === 'high') return 'high' as const;
  if (result.confidence === 'medium' && result.evidence_type === 'public_fact') return 'medium' as const;
  return 'low' as const;
}

function fallbackCauseFor(warning: string): BdrFallbackCause {
  if (/api key|not configured|missing/i.test(warning)) return 'provider_configuration';
  if (/provider|exa|firecrawl|browserbase|timeout|failed/i.test(warning)) return 'provider_failure';
  if (/agent/i.test(warning)) return 'agent_failure';
  return 'weak_evidence';
}

function fallbackInsert({
  lookup,
  warning,
  item,
}: {
  lookup: BdrLookupKey;
  warning: string;
  item?: BdrEvidenceDossierItem;
}): BdrPersonalizationInsert {
  return {
    confidence: 'low',
    evidence_type: item?.evidence_type ?? evidenceTypeForLookup(lookup),
    verified_fact: item?.snippet,
    source_url: item?.source_url,
    source_snippet: item?.snippet?.slice(0, 240),
    fallback_used: true,
    warning,
    fallback_cause: fallbackCauseFor(warning),
    qualification_rationale: item?.disqualification_reason ?? item?.ranking_rationale,
  };
}

function inferenceForLookup(lookup: BdrLookupKey, value: string) {
  if (lookup === 'hero_product') return `${value} can create fit, sizing, return, gift-timing, or pre-purchase question volume.`;
  if (lookup === 'complex_product') return `${value} can create pre-purchase decision complexity.`;
  if (lookup === 'subscription_signal') return `${value} can create save, cancel, or subscriber lifecycle moments.`;
  if (lookup === 'review_pattern') return `${value} can indicate a repeated customer friction pattern.`;
  if (lookup === 'support_jobs') return `${value} can indicate active ownership of support, routing, or retention operations.`;
  return `${value} can indicate roadmap sequencing relevance.`;
}

function normalizedHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
  }
}

function domainMatches(sourceUrl: string, domain?: string) {
  if (!domain) return false;
  const host = normalizedHost(sourceUrl);
  const normalizedDomain = domain.replace(/^www\./i, '').toLowerCase();
  return host === normalizedDomain || host.endsWith(`.${normalizedDomain}`);
}

function confidenceScore(confidence: BdrEvidenceDossierItem['confidence']) {
  if (confidence === 'high') return 0;
  if (confidence === 'medium') return 4;
  return 14;
}

function specificityScore(specificity: BdrEvidenceDossierItem['specificity']) {
  if (specificity === 'high') return -18;
  if (specificity === 'medium') return -6;
  return 18;
}

function repeatedPatternGroup(value: string) {
  const text = value.toLowerCase();
  if (/\bfit|sizing|size|runs small|runs large\b/.test(text)) return 'fit and sizing questions';
  if (/return|refund|exchange/.test(text)) return 'return or exchange friction';
  if (/shipping|delivery|late|delay/.test(text)) return 'shipping delays';
  if (/quality|defect|damaged|poorly made/.test(text)) return 'quality concerns';
  if (/support|service|response|chat|email/.test(text)) return 'support responsiveness';
  if (/scam|trust|fake|chargeback/.test(text)) return 'trust concerns';
  if (/cancel|subscription|pause|skip|replenish/.test(text)) return 'subscription-change friction';
  return undefined;
}

function specificityFor({
  lookup,
  sourceKind,
  result,
}: {
  lookup: BdrLookupKey;
  sourceKind: BdrPromptSource;
  result: ResearchResult;
}): BdrEvidenceDossierItem['specificity'] {
  const haystack = `${result.source_title ?? ''} ${result.source_url} ${result.quote_or_fact}`.toLowerCase();
  if (lookup === 'review_pattern') return repeatedPatternGroup(haystack) ? 'high' : 'low';
  if (lookup === 'support_jobs') {
    if (/(customer care|customer support|cx|member experience|concierge|retention|support operations).{0,80}(manager|director|lead|specialist|agent|associate)|routing|escalation|coverage|queue|retention/.test(haystack)) return 'high';
    if (/support|customer|care|cx|service/.test(haystack)) return 'medium';
    return 'low';
  }
  if (lookup === 'subscription_signal') {
    if (/cancel|pause|skip|save|upgrade|manage|recurring|autoship|replenish|subscription portal|subscriber/.test(haystack)) return 'high';
    if (/subscribe|subscription|membership|monthly/.test(haystack)) return 'medium';
    return 'low';
  }
  if (lookup === 'hero_product' || lookup === 'complex_product') {
    if (sourceKind === 'product_pages' && /collection|product|catalog|shop|sizing|fit|warranty|custom|delivery|bundle|sku/.test(haystack)) return 'high';
    if (/collection|product|catalog|shop|sizing|fit|warranty|custom|delivery|bundle/.test(haystack)) return 'medium';
    return 'low';
  }
  if (/replatform|omnichannel|ai|data|commerce|bopis|ship-from-store|partnership|modernization|rollout|expansion|hiring/.test(haystack)) return 'high';
  if (/digital|technology|roadmap|platform/.test(haystack)) return 'medium';
  return 'low';
}

function inferredOperatingMoment(lookup: BdrLookupKey, group?: string) {
  if (lookup === 'hero_product') return 'pre-purchase fit, sizing, returns, or product-comparison questions';
  if (lookup === 'complex_product') return 'pre-purchase decision support for a complex or high-consideration purchase';
  if (lookup === 'subscription_signal') return 'subscription save, cancel, skip, pause, or lifecycle moment';
  if (lookup === 'review_pattern') return group ? `${group} showing up as a repeated public customer friction pattern` : 'repeated public customer friction pattern';
  if (lookup === 'support_jobs') return 'support routing, coverage, escalation, or retention operations';
  return 'digital roadmap sequencing and customer continuity';
}

function requiresOfficialDomain(lookup: BdrLookupKey) {
  return lookup === 'hero_product' || lookup === 'complex_product' || lookup === 'subscription_signal';
}

function disqualificationReason({
  lookup,
  company,
  item,
}: {
  lookup: BdrLookupKey;
  company: CompanyInput;
  item: Pick<BdrEvidenceDossierItem, 'confidence' | 'domain_match' | 'specificity' | 'repeated_pattern_group'>;
}) {
  if (item.confidence === 'low') return 'Low-confidence evidence is below the personalization threshold.';
  if (company.domain && requiresOfficialDomain(lookup) && !item.domain_match) {
    return `No official-domain evidence found for ${company.company_name}.`;
  }
  if (item.specificity === 'low') return 'Evidence is too generic for the selected BDR lookup.';
  if (lookup === 'review_pattern' && !item.repeated_pattern_group) return 'Review evidence does not map to a repeated pattern.';
  return undefined;
}

function rankingRationale(item: Pick<BdrEvidenceDossierItem, 'source_kind' | 'confidence' | 'specificity' | 'domain_match' | 'repeated_pattern_group'>) {
  const parts = [
    `${item.source_kind} source`,
    `${item.confidence} confidence`,
    `${item.specificity} specificity`,
    item.domain_match ? 'official-domain match' : undefined,
    item.repeated_pattern_group ? `pattern: ${item.repeated_pattern_group}` : undefined,
  ].filter(Boolean);
  return parts.join('; ');
}

function scoreItem(item: BdrEvidenceDossierItem) {
  const domainPenalty = item.domain_match ? -8 : 6;
  const disqualifiedPenalty = item.qualified ? 0 : 60;
  return (item.source_priority * 10) + confidenceScore(item.confidence) + specificityScore(item.specificity) + domainPenalty + disqualifiedPenalty;
}

function strongestReviewPattern(items: BdrEvidenceDossierItem[], minimum: number) {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.repeated_pattern_group) continue;
    counts.set(item.repeated_pattern_group, (counts.get(item.repeated_pattern_group) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [group, count] of counts) {
    if (count > bestCount) {
      best = group;
      bestCount = count;
    }
  }
  return bestCount >= minimum ? best : undefined;
}

export function buildBdrEvidenceDossier({
  lookup,
  company,
  results,
  fallbackWarning,
  maxItems = 4,
}: {
  lookup: BdrLookupKey;
  company: CompanyInput;
  results: ResearchResult[];
  fallbackWarning: string;
  maxItems?: number;
}): BdrEvidenceDossier {
  const prompt = bdrPromptConfigForLookup(lookup);
  const sourcePriority = new Map(prompt.source_priority.map((source, index) => [source, index]));
  const seen = new Set<string>();
  const normalizedItems = results
    .filter((result) => result.source_url)
    .map((result) => {
      const sourceKind = sourceKindFor(result);
      const snippet = compact(result.quote_or_fact).slice(0, 500);
      const group = repeatedPatternGroup(`${result.source_title ?? ''} ${result.source_url} ${snippet}`);
      const item = {
        lookup,
        source_url: result.source_url,
        source_title: result.source_title,
        source_kind: sourceKind,
        source_priority: sourcePriority.get(sourceKind) ?? 99,
        snippet,
        evidence_type: evidenceTypeForLookup(lookup),
        confidence: confidenceFor(result),
        domain_match: domainMatches(result.source_url, company.domain),
        specificity: specificityFor({ lookup, sourceKind, result }),
        verified_fact: snippet,
        inferred_operating_moment: inferredOperatingMoment(lookup, group),
        repeated_pattern_group: group,
        qualified: true,
        ranking_rationale: '',
      };
      const reason = disqualificationReason({ lookup, company, item });
      return {
        ...item,
        qualified: !reason,
        disqualification_reason: reason,
        ranking_rationale: rankingRationale(item),
      };
    })
    .filter((item) => {
      const key = `${item.source_url}|${item.snippet.slice(0, 80)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const minimumReviewExamples = prompt.evidence_threshold.min_similar_review_examples ?? 3;
  const strongestPattern = lookup === 'review_pattern' ? strongestReviewPattern(normalizedItems.filter((item) => item.qualified), minimumReviewExamples) : undefined;
  const reviewQualifiedItems = lookup === 'review_pattern'
    ? normalizedItems.map((item) => {
      if (item.repeated_pattern_group === strongestPattern) return item;
      return {
        ...item,
        qualified: false,
        disqualification_reason: strongestPattern
          ? `Review evidence did not match the strongest repeated pattern: ${strongestPattern}.`
          : `Fewer than ${minimumReviewExamples} credible examples repeat the same review pattern.`,
      };
    })
    : normalizedItems;

  const items = reviewQualifiedItems
    .sort((a, b) => scoreItem(a) - scoreItem(b) || b.snippet.length - a.snippet.length)
    .slice(0, maxItems);

  const warnings: string[] = [];
  const qualifiedItems = items.filter((item) => item.qualified);
  if (qualifiedItems.length === 0) warnings.push(fallbackWarning);
  if (lookup === 'review_pattern' && !strongestPattern) warnings.push(fallbackWarning);
  if (lookup === 'support_jobs' && qualifiedItems.length === 0) warnings.push(fallbackWarning);
  if (company.domain && requiresOfficialDomain(lookup) && !qualifiedItems.some((item) => item.domain_match)) {
    warnings.push(`No official-domain evidence found for ${company.company_name}; used fallback when evidence was weak.`);
  }

  return { lookup, items, warnings: [...new Set(warnings)], fallback_cause: warnings.length > 0 ? fallbackCauseFor(warnings[0]) : undefined };
}

export function researchFindingFromDossier({
  company,
  dossier,
  fallbackWarning,
}: {
  company: CompanyInput;
  dossier: BdrEvidenceDossier;
  fallbackWarning: string;
}) {
  const warning = dossier.warnings[0];
  const first = dossier.items.find((item) => item.qualified);
  if (warning || !first) {
    return {
      evidence_urls: dossier.items.map((item) => item.source_url),
      warning: warning ?? fallbackWarning,
      insert: fallbackInsert({ lookup: dossier.lookup, warning: warning ?? fallbackWarning, item: first }),
    };
  }

  const rawValue = dossier.lookup === 'review_pattern' && first.repeated_pattern_group
    ? first.repeated_pattern_group
    : `${first.source_title ?? ''} ${first.snippet}`;
  const value = sanitizeBdrPersonalizationValue({ value: rawValue, lookup: dossier.lookup, companyName: company.company_name });
  if (!value) {
    return {
      evidence_urls: dossier.items.map((item) => item.source_url),
      warning: fallbackWarning,
      insert: fallbackInsert({ lookup: dossier.lookup, warning: fallbackWarning, item: first }),
    };
  }

  return {
    value,
    evidence_urls: dossier.items.map((item) => item.source_url),
    insert: {
      selected_insert: value,
      confidence: first.confidence,
      evidence_type: first.evidence_type,
      verified_fact: first.snippet,
      inference_used: inferenceForLookup(dossier.lookup, value),
      source_url: first.source_url,
      source_snippet: first.snippet.slice(0, 240),
      fallback_used: false,
      qualification_rationale: first.ranking_rationale,
    },
  };
}
