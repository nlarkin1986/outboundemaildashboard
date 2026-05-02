import { BDR_SEQUENCES } from './sequences';
import type { BdrLookupKey, BdrSequenceCode } from './types';

export const BDR_PROMPT_PACK_REVISION = 'bdr-cold-outbound-inline-prompts-2026-05-02';

export type BdrPromptSource =
  | 'official_site'
  | 'product_pages'
  | 'help_center'
  | 'careers'
  | 'press'
  | 'reviews'
  | 'social'
  | 'browser_fallback';

export type BdrPromptEvidenceThreshold = {
  min_similar_review_examples?: number;
  min_relevant_open_roles?: number;
  allow_fallback: boolean;
};

export type BdrPromptLanguageConstraints = {
  audience: 'cx' | 'support_ops' | 'digital' | 'ecommerce';
  preferred_terms: string[];
  disallowed_terms: string[];
};

export type BdrStepPromptSlice = {
  prompt_pack_revision: typeof BDR_PROMPT_PACK_REVISION;
  sequence_code: BdrSequenceCode;
  original_step_number: 1 | 4;
  lookup: BdrLookupKey;
  source_priority: BdrPromptSource[];
  retrieval_order: string[];
  evidence_threshold: BdrPromptEvidenceThreshold;
  instruction: string;
  insert_shape: string;
  fallback_rule: string;
  language_constraints: BdrPromptLanguageConstraints;
  output_contract: string[];
};

const outputContract = [
  'selected_insert',
  'confidence',
  'evidence_type',
  'verified_fact',
  'inference_used',
  'source_url',
  'source_snippet',
  'fallback_used',
];

const retrievalOrder = [
  'Use Exa search first with official-domain and query-intent searches.',
  'Extract the best static pages into clean evidence before using them.',
  'Use Browserbase only when static extraction cannot read a JS-rendered catalog, help center, or support workflow.',
];

const lookupPrompt: Record<BdrLookupKey, {
  source_priority: BdrPromptSource[];
  evidence_threshold: BdrPromptEvidenceThreshold;
  instruction: string;
  insert_shape: string;
  fallback_rule: string;
}> = {
  hero_product: {
    source_priority: ['official_site', 'product_pages', 'social', 'browser_fallback'],
    evidence_threshold: { allow_fallback: true },
    instruction: 'Find a current product, collection, campaign, or launch that plausibly creates fit, sizing, gift-timing, return, or pre-purchase question volume.',
    insert_shape: "{{first_name}} -- {{company}}'s [collection/campaign] likely puts [fit/sizing/gift timing/product-comparison] questions right in the buying moment.",
    fallback_rule: 'Use only when the campaign or product is current, prominent, and naturally tied to the sequence angle. Otherwise omit the personalization line.',
  },
  complex_product: {
    source_priority: ['official_site', 'product_pages', 'help_center', 'browser_fallback'],
    evidence_threshold: { allow_fallback: true },
    instruction: 'Find the most complex, customizable, high-ticket, compatibility-heavy, delivery-heavy, warranty-heavy, or expert-guidance product or category.',
    insert_shape: '{{first_name}} -- [product/category] on the {{company}} site looks like the kind of purchase where customers need a real answer before they buy.',
    fallback_rule: 'Use a category-level insert only when a specific product does not stand out but the decision complexity is still clear. Otherwise fall back.',
  },
  subscription_signal: {
    source_priority: ['official_site', 'help_center', 'careers', 'press', 'reviews', 'browser_fallback'],
    evidence_threshold: { min_similar_review_examples: 3, allow_fallback: true },
    instruction: 'Find the strongest signal that subscription retention, cancellation, pause, skip, save logic, replenishment, lifecycle, or growth is operationally important.',
    insert_shape: '{{first_name}} -- [specific retention/cancel/subscription signal] makes the save/cancel moment look like a revenue workflow, not just a support workflow.',
    fallback_rule: 'Prefer retention jobs, official cancel or subscription terms, and subscription-growth evidence. Use reviews only when at least three credible examples repeat the same pattern.',
  },
  digital_signal: {
    source_priority: ['press', 'careers', 'official_site', 'product_pages'],
    evidence_threshold: { allow_fallback: true },
    instruction: 'Find a concrete digital or operating-model signal such as replatforming, eCommerce 2.0, omnichannel rollout, BOPIS, ship-from-store, data or AI hiring, executive hire, expansion, or conversion/retention modernization.',
    insert_shape: 'Given [specific verified initiative], the sequencing question is probably where [pre-purchase support / returns / subscription save moments / concierge continuity] fits into the digital roadmap.',
    fallback_rule: 'Do not use vague transformation language. If no concrete initiative exists, omit the personalization line.',
  },
  review_pattern: {
    source_priority: ['reviews', 'social'],
    evidence_threshold: { min_similar_review_examples: 3, allow_fallback: true },
    instruction: 'Find repeated credible review or public-thread patterns tied to the selected sequence angle. Do not quote inflammatory language or claim the company has a problem.',
    insert_shape: 'Pulled up recent {{company}} reviews and [specific pattern] shows up more than once -- that usually points to [operating moment], not generic support volume.',
    fallback_rule: 'Use Version A only when at least three recent or credible examples repeat the same pattern. Otherwise use Version B.',
  },
  support_jobs: {
    source_priority: ['careers', 'official_site'],
    evidence_threshold: { min_relevant_open_roles: 2, allow_fallback: true },
    instruction: 'Find open support, CX, customer care, member experience, concierge, retention operations, or support operations roles. Prefer exact role titles and responsibilities over raw counts.',
    insert_shape: '{{company}} is hiring for [exact role/title or count], with responsibilities around [exact responsibility]. That usually means [volume/coverage/retention/routing] is active enough to have an owner.',
    fallback_rule: 'Use Version A only when there are at least two relevant roles or one senior role tied directly to the sequence angle. Do not infer crisis from hiring.',
  },
  digital_investment: {
    source_priority: ['press', 'careers', 'official_site', 'product_pages'],
    evidence_threshold: { allow_fallback: true },
    instruction: 'Find a concrete digital or operating-model signal and convert it into a business sequencing sentence for a digital or ecommerce executive.',
    insert_shape: 'Given [specific verified initiative], the sequencing question is probably where [pre-purchase support / returns / subscription save moments / concierge continuity] fits into the digital roadmap.',
    fallback_rule: 'Use Version A only for concrete evidence. Otherwise use the generic benchmark body.',
  },
};

export function bdrPromptConfigForLookup(lookup: BdrLookupKey) {
  return lookupPrompt[lookup];
}

const defaultLanguageConstraints: Record<BdrPromptLanguageConstraints['audience'], BdrPromptLanguageConstraints> = {
  cx: {
    audience: 'cx',
    preferred_terms: ['customer moment', 'conversion funnel', 'continuity', 'support experience'],
    disallowed_terms: ['vague transformation language', 'unsupported pain claims'],
  },
  support_ops: {
    audience: 'support_ops',
    preferred_terms: ['routing', 'coverage', 'authority to resolve', 'specialized contact mix'],
    disallowed_terms: ['crisis', 'broken support', 'unsupported pressure claims'],
  },
  digital: {
    audience: 'digital',
    preferred_terms: ['revenue recovery', 'cart completion', 'modernization', 'digital program', 'ROI', 'LTV'],
    disallowed_terms: ['agents', 'CSAT', 'support queue', 'handle time', 'tickets'],
  },
  ecommerce: {
    audience: 'ecommerce',
    preferred_terms: ['conversion', 'cart completion', 'AOV', 'revenue per visitor', 'customer LTV', 'repeat purchase rate'],
    disallowed_terms: ['CSAT', 'handle time', 'agents', 'tickets', 'support queue'],
  },
};

function languageConstraintsFor(code: BdrSequenceCode): BdrPromptLanguageConstraints {
  if (code.startsWith('D-')) return defaultLanguageConstraints.ecommerce;
  if (code.endsWith('-3')) return defaultLanguageConstraints.digital;
  if (code.endsWith('-2')) return defaultLanguageConstraints.support_ops;
  return defaultLanguageConstraints.cx;
}

function sliceFor(code: BdrSequenceCode, originalStepNumber: 1 | 4): BdrStepPromptSlice {
  const sequence = BDR_SEQUENCES[code];
  const lookup = originalStepNumber === 1 ? sequence.step1.lookup : sequence.step4.lookup;
  const prompt = lookupPrompt[lookup];
  return {
    prompt_pack_revision: BDR_PROMPT_PACK_REVISION,
    sequence_code: code,
    original_step_number: originalStepNumber,
    lookup,
    source_priority: prompt.source_priority,
    retrieval_order: retrievalOrder,
    evidence_threshold: prompt.evidence_threshold,
    instruction: prompt.instruction,
    insert_shape: prompt.insert_shape,
    fallback_rule: prompt.fallback_rule,
    language_constraints: languageConstraintsFor(code),
    output_contract: outputContract,
  };
}

export function bdrPromptPackSlice(code: BdrSequenceCode, originalStepNumber: 1 | 4): BdrStepPromptSlice {
  return sliceFor(code, originalStepNumber);
}

export function bdrPromptPackSlices(code: BdrSequenceCode): BdrStepPromptSlice[] {
  return [sliceFor(code, 1), sliceFor(code, 4)];
}

export function allBdrPromptPackSlices(): BdrStepPromptSlice[] {
  return (Object.keys(BDR_SEQUENCES) as BdrSequenceCode[]).flatMap((code) => bdrPromptPackSlices(code));
}
