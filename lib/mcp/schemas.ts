import { z } from 'zod';

export const mcpActorSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().optional(),
  cowork_user_id: z.string().optional(),
  cowork_org_id: z.string().optional(),
  cowork_thread_id: z.string().optional(),
});

export const createOutboundSequenceSchema = z.object({
  actor: mcpActorSchema,
  companies: z.array(z.object({
    company_name: z.string().min(1),
    domain: z.string().optional(),
    contacts: z.array(z.object({
      name: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      title: z.string().optional(),
      company: z.string().optional(),
      email: z.string().email().optional(),
      domain: z.string().optional(),
    })).optional(),
  })).min(1),
  mode: z.enum(['fast', 'deep']).default('fast'),
  play_id: z.enum(['bdr_cold_outbound']).optional(),
  play_metadata: z.record(z.string(), z.unknown()).optional(),
  target_persona: z.string().optional(),
  campaign_id: z.string().nullable().optional(),
});

export const getOutboundSequenceStatusSchema = z.object({
  batch_id: z.string().min(1),
  actor: mcpActorSchema,
});

export type CreateOutboundSequenceInput = z.input<typeof createOutboundSequenceSchema>;
export type GetOutboundSequenceStatusInput = z.input<typeof getOutboundSequenceStatusSchema>;
