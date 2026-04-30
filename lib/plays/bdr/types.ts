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

export type BdrTemplateVariant = {
  body: string;
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
  };
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
