import { z } from 'zod';

export const companyAgentOutputSchema = z.object({
  company_name: z.string(),
  domain: z.string().optional(),
  core_hypothesis: z.string(),
  evidence_ledger: z.array(z.object({
    claim: z.string(),
    source_url: z.string().url().optional(),
    evidence_type: z.enum(['public_fact', 'inference', 'guardrail']),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
  contacts: z.array(z.object({
    email: z.string().email(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    title: z.string().optional(),
    company: z.string(),
    primary_angle: z.string(),
    opening_hook: z.string(),
    proof_used: z.string(),
    guardrail: z.string().optional(),
    sequence_code: z.string().optional(),
    play_metadata: z.record(z.string(), z.unknown()).optional(),
    evidence_urls: z.array(z.string().url()).default([]),
    qa_warnings: z.array(z.string()).default([]),
    emails: z.array(z.object({
      step_number: z.number().int().positive(),
      original_step_number: z.number().int().positive().optional(),
      step_label: z.string().optional(),
      subject: z.string(),
      body_text: z.string(),
      body_html: z.string(),
    })).min(1),
  })),
});

export type CompanyAgentOutput = z.infer<typeof companyAgentOutputSchema>;
