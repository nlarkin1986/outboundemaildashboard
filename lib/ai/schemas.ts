import { z } from 'zod';

export const generatedContactSequenceSchema = z.object({
  contact: z.object({
    email: z.string().email(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    title: z.string().optional(),
    company: z.string(),
    domain: z.string().optional(),
  }),
  research_quality: z.enum(['full', 'thin', 'insufficient']),
  primary_angle: z.string().min(1),
  backup_angle: z.string().optional(),
  opening_hook: z.string().min(1),
  proof_used: z.string().min(1),
  guardrail: z.string().min(1),
  evidence_urls: z.array(z.string()),
  evidence_ledger: z.array(z.object({
    type: z.enum(['public_fact', 'inference', 'proof_point']),
    text: z.string(),
    source_url: z.string().optional(),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
  qa_warnings: z.array(z.string()),
  emails: z.array(z.object({
    step_number: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    subject: z.string().min(1),
    body_html: z.string().min(1),
    body_text: z.string().min(1),
  })).length(3),
});

export type GeneratedContactSequence = z.infer<typeof generatedContactSequenceSchema>;
