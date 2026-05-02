import { anthropic } from '@ai-sdk/anthropic';
import { Output, ToolLoopAgent, stepCountIs } from 'ai';
import { z } from 'zod';
import type { CompanyInput } from '@/lib/schemas';
import { metadataConfirmsBdrPlay } from './intent';
import { BDR_PLAY_ID } from './types';

type RouteInput = {
  play_id?: string;
  play_metadata?: Record<string, unknown>;
  target_persona?: string;
  request_context?: string;
  user_request?: string;
  campaign_id?: string | null;
  mode?: 'fast' | 'deep';
  companies: CompanyInput[];
};

export type RouteResolution = {
  input: Omit<RouteInput, 'request_context' | 'user_request' | 'play_id'> & { play_id?: typeof BDR_PLAY_ID };
  selected_route: 'bdr_workflow' | 'generic_company_agent';
  source: 'explicit_play_id' | 'metadata' | 'heuristic' | 'vercel_agent_sdk' | 'custom_signal';
  warnings: string[];
};

const intakeRouteSchema = z.object({
  route: z.enum([BDR_PLAY_ID, 'generic_custom']),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string(),
  intake: z.object({
    user_request_summary: z.string().nullable(),
    input_format: z.enum(['csv', 'pasted_accounts', 'single_account', 'unknown']),
    push_intent: z.enum(['review_first', 'push_after_review', 'unknown']),
  }),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function existingIntake(metadata?: Record<string, unknown>) {
  return isRecord(metadata?.intake) ? metadata.intake : {};
}

function requestContext(input: RouteInput) {
  const intake = existingIntake(input.play_metadata);
  return [
    input.request_context,
    input.user_request,
    stringValue(input.play_metadata?.user_request_summary),
    stringValue(input.play_metadata?.request_summary),
    stringValue(intake.user_request_summary),
    stringValue(intake.request_summary),
  ].filter(Boolean).join('\n');
}

function companyContext(input: RouteInput) {
  return input.companies.map((company) => {
    const contacts = (company.contacts ?? []).map((contact) => [
      contact.name,
      contact.first_name,
      contact.last_name,
      contact.title,
      contact.email,
    ].filter(Boolean).join(' ')).join('; ');
    return [company.company_name, company.domain, contacts].filter(Boolean).join(' ');
  }).join('\n');
}

function inferInputFormat(input: RouteInput) {
  const context = requestContext(input).toLowerCase();
  if (context.includes('csv')) return 'csv';
  if (input.companies.length === 1) return 'single_account';
  return 'pasted_accounts';
}

function inferPushIntent(input: RouteInput) {
  const context = requestContext(input).toLowerCase();
  if (input.campaign_id || context.includes('campaign') || context.includes('push')) return 'push_after_review';
  return 'review_first';
}

function hasContactTitle(input: RouteInput) {
  return input.companies.some((company) => company.contacts?.some((contact) => Boolean(contact.title)));
}

function hasOnlyLightBdrShape(input: RouteInput) {
  return !input.target_persona && input.companies.length > 0 && hasContactTitle(input);
}

function heuristicRoute(input: RouteInput): RouteResolution | null {
  const context = `${requestContext(input)}\n${companyContext(input)}`.toLowerCase();
  const explicitCustom = /\b(fully custom|custom sequence|custom outbound|generic outbound)\b/.test(context);
  const bdrSignal = /\b(bdr|cold outbound|outreach sequence play|sequence this account|sequence these accounts|run outreach|prepare outreach|build outbound|prospect(?:ing)? sequence)\b/.test(context);

  if (input.play_id === BDR_PLAY_ID) return bdrResolution(input, 'explicit_play_id');
  if (metadataConfirmsBdrPlay(input.play_metadata)) return bdrResolution(input, 'metadata');
  if (bdrSignal && !explicitCustom) return bdrResolution(input, 'heuristic');
  if (explicitCustom) return genericResolution(input, 'custom_signal');
  if (hasOnlyLightBdrShape(input)) return bdrResolution(input, 'heuristic');
  return null;
}

function bdrMetadata(input: RouteInput, source: RouteResolution['source'], agentIntake?: z.infer<typeof intakeRouteSchema>['intake']) {
  const metadata = input.play_metadata ?? {};
  const intake = existingIntake(metadata);
  const summary = agentIntake?.user_request_summary || stringValue(intake.user_request_summary) || requestContext(input) || 'Server-side intake selected the BDR cold outbound play.';
  return {
    ...metadata,
    intake: {
      ...intake,
      user_request_summary: summary,
      confirmed_play: BDR_PLAY_ID,
      play_id: BDR_PLAY_ID,
      input_format: stringValue(intake.input_format) ?? agentIntake?.input_format ?? inferInputFormat(input),
      push_intent: stringValue(intake.push_intent) ?? agentIntake?.push_intent ?? inferPushIntent(input),
      route_source: source,
    },
    routing: {
      ...(isRecord(metadata.routing) ? metadata.routing : {}),
      selected_by: source === 'vercel_agent_sdk' ? 'vercel_agent_sdk_tool_loop_agent' : 'server_intake_router',
      selected_play_id: BDR_PLAY_ID,
    },
  };
}

function bdrResolution(input: RouteInput, source: RouteResolution['source'], agentIntake?: z.infer<typeof intakeRouteSchema>['intake']): RouteResolution {
  return {
    input: {
      ...stripRoutingOnlyFields(input),
      play_id: BDR_PLAY_ID,
      play_metadata: bdrMetadata(input, source, agentIntake),
    },
    selected_route: 'bdr_workflow',
    source,
    warnings: [],
  };
}

function genericResolution(input: RouteInput, source: RouteResolution['source'], warnings: string[] = []): RouteResolution {
  const { play_id: _playId, ...stripped } = stripRoutingOnlyFields(input);
  return {
    input: stripped,
    selected_route: 'generic_company_agent',
    source,
    warnings,
  };
}

function stripRoutingOnlyFields(input: RouteInput) {
  const { request_context: _requestContext, user_request: _userRequest, ...rest } = input;
  return rest;
}

async function runVercelIntakeAgent(input: RouteInput) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.OUTBOUND_INTAKE_AGENT_DISABLED === 'true') return null;

  const agent = new ToolLoopAgent({
    id: 'outbound-play-intake-router',
    model: anthropic(process.env.OUTBOUND_INTAKE_AGENT_MODEL ?? 'claude-haiku-4-5'),
    instructions: [
      'You route Gladly outbound intake into exactly one backend path.',
      `Choose "${BDR_PLAY_ID}" when the user wants the BDR cold outbound sequence play, asks to sequence accounts, run BDR outreach, run cold outbound, or provides account/contact/title inputs without custom copy instructions.`,
      'Choose "generic_custom" only when the user clearly asks for a fully custom sequence, gives a custom target persona/instructions, or explicitly does not want the BDR play.',
      'Do not choose sequence codes, brand type, personas, placeholders, subjects, or email copy. The backend BDR workflow owns those.',
      'Return structured output only.',
    ].join('\n'),
    output: Output.object({ schema: intakeRouteSchema }),
    stopWhen: stepCountIs(1),
    temperature: 0,
    maxOutputTokens: 600,
  });

  const result = await agent.generate({
    prompt: JSON.stringify({
      request_context: requestContext(input),
      target_persona: input.target_persona,
      campaign_id: input.campaign_id,
      play_metadata: input.play_metadata,
      companies: input.companies,
    }),
  });

  return result.output;
}

export async function resolveOutboundPlayRoute(input: RouteInput): Promise<RouteResolution> {
  const deterministic = heuristicRoute(input);
  if (deterministic) return deterministic;

  try {
    const agentResult = await runVercelIntakeAgent(input);
    if (agentResult?.route === BDR_PLAY_ID && agentResult.confidence !== 'low') {
      return bdrResolution(input, 'vercel_agent_sdk', agentResult.intake);
    }
    if (agentResult?.route === 'generic_custom') {
      return genericResolution(input, 'vercel_agent_sdk');
    }
  } catch (error) {
    return genericResolution(input, 'vercel_agent_sdk', [
      `Vercel intake agent could not classify the request; defaulted to generic/custom route: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }

  return genericResolution(input, 'heuristic');
}
