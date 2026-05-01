import { z } from 'zod';

export const BDR_PLAY_ID = 'bdr_cold_outbound' as const;

export type BdrBrandTypeCode = 'A' | 'B' | 'C';
export type BdrPersonaCode = '1' | '2' | '3' | 'D';
export type BdrSequenceCode = `${BdrBrandTypeCode}-${'1' | '2' | '3'}` | `D-${1 | 2 | 3}`;

export type BdrBrandClassification = {
  code?: BdrBrandTypeCode;
  label?: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  warning?: string;
};

export type BdrPersonaClassification = {
  code?: BdrPersonaCode;
  label?: string;
  reason: string;
  warning?: string;
};

export type BdrSequenceSelection = {
  brand: BdrBrandClassification;
  persona: BdrPersonaClassification;
  sequence_code?: BdrSequenceCode;
  warnings: string[];
};

export type BdrLookupKey = BdrSequenceTemplate['step1']['lookup'] | BdrSequenceTemplate['step4']['lookup'];
export type BdrEvidenceType = 'product' | 'help_center' | 'jobs' | 'press' | 'reviews' | 'social' | 'inference';

export type BdrPersonalizationInsert = {
  selected_insert?: string;
  confidence: 'high' | 'medium' | 'low';
  evidence_type: BdrEvidenceType;
  verified_fact?: string;
  inference_used?: string;
  source_url?: string;
  source_snippet?: string;
  fallback_used: boolean;
  warning?: string;
};

export type BdrSequencePlan = {
  contact_key: string;
  sequence?: BdrSequenceSelection;
  sequence_code?: BdrSequenceCode;
  confidence: 'high' | 'medium' | 'low';
  required_lookups: BdrLookupKey[];
  evidence_urls: string[];
  evidence_claims: string[];
  warnings: string[];
};

export type BdrPlaceholderResearch = {
  sequence_code: BdrSequenceCode;
  step1: {
    lookup: BdrSequenceTemplate['step1']['lookup'];
    value?: string;
    insert?: BdrPersonalizationInsert;
    evidence_urls: string[];
    warning?: string;
  };
  step4: {
    lookup: BdrSequenceTemplate['step4']['lookup'];
    value?: string;
    insert?: BdrPersonalizationInsert;
    evidence_urls: string[];
    warning?: string;
  };
  account_evidence_urls: string[];
  account_evidence_claims: string[];
  warnings: string[];
};

export type BdrTemplateVariant = {
  body: string;
};

export type BdrLinkedInTemplate = {
  label: string;
  note: string;
  max_length: number;
};

export type BdrSequenceTemplate = {
  code: BdrSequenceCode;
  brand_label: string;
  persona_label: string;
  step1: {
    subject: string;
    label: string;
    lookup: 'hero_product' | 'complex_product' | 'digital_signal' | 'subscription_signal';
    body: string;
    fallback_body?: string;
    insert_rule?: string;
  };
  linkedin?: BdrLinkedInTemplate;
  step4: {
    subject: string;
    label: string;
    lookup: 'review_pattern' | 'support_jobs' | 'digital_investment';
    version_a?: BdrTemplateVariant;
    version_b: BdrTemplateVariant;
  };
};

export const bdrPlayMetadataSchema = z.object({
  play_id: z.literal(BDR_PLAY_ID),
  sequence_code: z.string().optional(),
  brand_type: z.string().optional(),
  persona: z.string().optional(),
});
