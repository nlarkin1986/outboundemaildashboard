import { z } from 'zod';

export const contactInputSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  email: z.string().email().transform((v) => v.toLowerCase()),
  domain: z.string().optional(),
});

export const createRunSchema = z.object({
  company_name: z.string().min(1),
  domain: z.string().optional(),
  mode: z.enum(['fast', 'deep']).default('fast'),
  source: z.enum(['cowork', 'manual', 'api']).default('api'),
  campaign_id: z.string().optional(),
  cowork_thread_id: z.string().optional(),
  contacts: z.array(contactInputSchema).min(1),
});

export const emailStepSchema = z.object({
  id: z.string().optional(),
  step_number: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  subject: z.string().min(1),
  body_html: z.string().min(1),
  body_text: z.string().optional(),
});

export const reviewContactSchema = z.object({
  id: z.string(),
  status: z.enum(['needs_edit', 'approved', 'skipped']),
  primary_angle: z.string().optional(),
  opening_hook: z.string().optional(),
  proof_used: z.string().optional(),
  guardrail: z.string().optional(),
  evidence_urls: z.array(z.string()).optional(),
  qa_warnings: z.array(z.string()).optional(),
  emails: z.array(emailStepSchema).min(3),
});

export const saveReviewSchema = z.object({
  contacts: z.array(reviewContactSchema).min(1),
});

export type CreateRunInput = z.input<typeof createRunSchema>;
export type ContactInput = z.input<typeof contactInputSchema>;
export type ReviewContactInput = z.infer<typeof reviewContactSchema>;
export type SaveReviewInput = z.infer<typeof saveReviewSchema>;
