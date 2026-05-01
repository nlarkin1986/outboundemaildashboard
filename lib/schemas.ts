import { z } from 'zod';

export const contactInputSchema = z.object({
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  email: z.string().email().transform((v) => v.toLowerCase()),
  domain: z.string().optional(),
});

export const batchContactInputSchema = contactInputSchema.extend({
  email: z.string().email().transform((v) => v.toLowerCase()).optional(),
});

const coworkActorSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().optional(),
  cowork_user_id: z.string().optional(),
  cowork_org_id: z.string().optional(),
  cowork_thread_id: z.string().optional(),
});

export const createRunSchema = z.object({
  company_name: z.string().min(1),
  domain: z.string().optional(),
  mode: z.enum(['fast', 'deep']).default('fast'),
  source: z.enum(['cowork', 'manual', 'api']).default('api'),
  play_id: z.string().optional(),
  play_metadata: z.record(z.string(), z.unknown()).optional(),
  account_id: z.string().optional(),
  created_by_user_id: z.string().optional(),
  created_by: z.string().optional(),
  campaign_id: z.string().optional(),
  cowork_thread_id: z.string().optional(),
  contacts: z.array(contactInputSchema).min(1),
});

export const emailStepSchema = z.object({
  id: z.string().optional(),
  step_number: z.number().int().positive(),
  original_step_number: z.number().int().positive().optional(),
  step_label: z.string().optional(),
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
  sequence_code: z.string().optional(),
  play_metadata: z.record(z.string(), z.unknown()).optional(),
  evidence_urls: z.array(z.string()).optional(),
  qa_warnings: z.array(z.string()).optional(),
  emails: z.array(emailStepSchema).min(1),
});

export const saveReviewSchema = z.object({
  contacts: z.array(reviewContactSchema).min(1),
});

export type CreateRunInput = z.input<typeof createRunSchema>;
export type ContactInput = z.input<typeof contactInputSchema>;
export type BatchContactInput = z.input<typeof batchContactInputSchema>;
export type ReviewContactInput = z.infer<typeof reviewContactSchema>;
export type SaveReviewInput = z.infer<typeof saveReviewSchema>;


export const companyInputSchema = z.object({
  company_name: z.string().min(1),
  domain: z.string().optional(),
  contacts: z.array(batchContactInputSchema).optional(),
});

export const createBatchSchema = z.object({
  actor: coworkActorSchema.optional(),
  requested_by: z.string().optional(),
  requested_by_email: z.string().optional(),
  user_email: z.string().optional(),
  actor_email: z.string().optional(),
  created_by_email: z.string().optional(),
  cowork_thread_id: z.string().optional(),
  campaign_id: z.string().optional(),
  mode: z.enum(['fast', 'deep']).default('fast'),
  source: z.enum(['cowork', 'manual', 'api']).default('cowork'),
  play_id: z.enum(['bdr_cold_outbound']).optional(),
  play_metadata: z.record(z.string(), z.unknown()).optional(),
  target_persona: z.string().optional(),
  companies: z.array(companyInputSchema).min(1),
});

export const saveBatchReviewSchema = z.object({
  runs: z.array(z.object({
    run_id: z.string(),
    contacts: z.array(reviewContactSchema),
  })).min(1),
});

export type CompanyInput = z.input<typeof companyInputSchema>;
export type CreateBatchInput = z.input<typeof createBatchSchema>;
export type SaveBatchReviewInput = z.infer<typeof saveBatchReviewSchema>;
