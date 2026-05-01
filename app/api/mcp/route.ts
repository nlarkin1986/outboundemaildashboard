import { NextResponse } from 'next/server';
import { createOutboundSequence, getOutboundSequenceStatus } from '@/lib/mcp/outbound-tools';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,content-type,x-mcp-secret,mcp-session-id',
};

function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, { ...init, headers: { ...corsHeaders, ...(init?.headers ?? {}) } });
}

function authError(request: Request) {
  if (process.env.MCP_AUTH_DISABLED === 'true') return null;
  if (!process.env.MCP_API_SECRET && process.env.VERCEL) return 'MCP_API_SECRET is not configured';
  if (process.env.MCP_API_SECRET) {
    const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? request.headers.get('x-mcp-secret');
    if (provided !== process.env.MCP_API_SECRET) return 'Unauthorized';
  }
  return null;
}

class UnknownMcpToolError extends Error {}

const pollingOutputSchema = {
  type: 'object',
  required: ['ok', 'batch_id', 'status', 'review_url', 'dashboard_status_url', 'poll_tool', 'recommended_poll_after_seconds', 'max_poll_attempts', 'is_terminal', 'cowork_next_action'],
  additionalProperties: true,
  properties: {
    ok: { type: 'boolean' },
    batch_id: { type: 'string' },
    status: { type: 'string' },
    play_id: { type: 'string' },
    review_url: { type: 'string' },
    dashboard_status_url: { type: 'string' },
    poll_tool: { type: 'string' },
    recommended_poll_after_seconds: { type: 'number' },
    max_poll_attempts: { type: 'number' },
    is_terminal: { type: 'boolean' },
    cowork_next_action: { type: 'object', additionalProperties: true },
    processing: {
      type: 'object',
      additionalProperties: true,
      properties: {
        started: { type: 'boolean' },
        mode: { type: 'string' },
        correlation_id: { type: 'string' },
        requested_at: { type: 'string' },
        internal_path: { type: 'string' },
        state: { type: 'string' },
        run_count: { type: 'number' },
      },
    },
    diagnostics: {
      type: 'object',
      additionalProperties: true,
      properties: {
        processing_route: { type: 'string' },
        runtime: { type: 'string' },
        persistence: { type: 'string' },
        deployment: {
          type: 'object',
          additionalProperties: true,
          properties: {
            contract_revision: { type: 'string' },
            environment: { type: 'string' },
            deployment_url: { type: 'string' },
            git: { type: 'object', additionalProperties: true },
          },
        },
        research_providers: { type: 'object', additionalProperties: true },
      },
    },
  },
};

const tools = [
  {
    name: 'create_outbound_sequence',
    description: 'Create a Gladly outbound sequence batch for a Cowork user. Returns immediately with a durable batch_id, dashboard URL, review URL, and polling instructions. For the BDR cold outbound play, Cowork determines play intent and sets play_id to bdr_cold_outbound after confirming sequencing intent and collecting company, domain when known, contact names, contact titles, optional emails, and campaign_id when the user wants push. The Vercel workflow determines the BDR sequence code and researches the selected placeholders. Ask at most two follow-up turns before calling: one to confirm the BDR play if intent is ambiguous, one to collect missing required account/contact/title/campaign details. If status is queued, processing, or pushing, call get_outbound_sequence_status after recommended_poll_after_seconds until terminal/action state. Requires actor.email.',
    inputSchema: {
      type: 'object',
      required: ['actor', 'companies'],
      properties: {
        actor: { type: 'object', required: ['email'], properties: { email: { type: 'string' }, name: { type: 'string' }, cowork_user_id: { type: 'string' }, cowork_org_id: { type: 'string' }, cowork_thread_id: { type: 'string' } } },
        companies: { type: 'array', items: { type: 'object', required: ['company_name'], properties: { company_name: { type: 'string' }, domain: { type: 'string' }, contacts: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, first_name: { type: 'string' }, last_name: { type: 'string' }, title: { type: 'string' }, email: { type: 'string' }, company: { type: 'string' }, domain: { type: 'string' } } } } } } },
        mode: { type: 'string', enum: ['fast', 'deep'] },
        play_id: { type: 'string', enum: ['bdr_cold_outbound'], description: 'Use bdr_cold_outbound for the BDR cold outbound sequencing play. Omit for the existing generic outbound flow.' },
        play_metadata: { type: 'object', additionalProperties: true },
        target_persona: { type: 'string' },
        campaign_id: { type: ['string', 'null'] },
      },
    },
    outputSchema: pollingOutputSchema,
  },
  {
    name: 'get_outbound_sequence_status',
    description: 'Poll a Gladly outbound sequence batch by batch_id. Use this after create_outbound_sequence. Follow cowork_next_action and recommended_poll_after_seconds until ready_for_review, partially_failed, failed, review_submitted, or pushed.',
    inputSchema: {
      type: 'object',
      required: ['batch_id', 'actor'],
      properties: { batch_id: { type: 'string' }, actor: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } } },
    },
    outputSchema: {
      ...pollingOutputSchema,
      required: [...pollingOutputSchema.required, 'run_counts'],
      properties: {
        ...pollingOutputSchema.properties,
        run_counts: { type: 'object', additionalProperties: true },
        errors: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
    },
  },
];

async function callTool(name: string, input: unknown) {
  if (name === 'create_outbound_sequence') return createOutboundSequence(input as any);
  if (name === 'get_outbound_sequence_status') return getOutboundSequenceStatus(input as any);
  throw new UnknownMcpToolError(`Unknown MCP tool: ${name || 'missing'}`);
}

function toolResult(result: unknown, isError = false) {
  return {
    content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }],
    structuredContent: typeof result === 'object' && result !== null ? result : { message: String(result) },
    isError,
  };
}

function jsonRpcError(id: unknown, code: number, message: string, status = 400) {
  return json({ jsonrpc: '2.0', id, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const auth = authError(request);
  if (auth) return json({ error: auth }, { status: auth === 'Unauthorized' ? 401 : 503 });

  try {
    const body = await request.json();
    if (body?.jsonrpc === '2.0') {
      if (body.method === 'initialize') return json({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: body.params?.protocolVersion ?? '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'gladly-outbound-approval', version: '0.1.0' } } });
      if (body.method === 'notifications/initialized') return new Response(null, { status: 202, headers: corsHeaders });
      if (body.method === 'ping') return json({ jsonrpc: '2.0', id: body.id, result: {} });
      if (body.method === 'tools/list') return json({ jsonrpc: '2.0', id: body.id, result: { tools } });
      if (body.method === 'tools/call') {
        try {
          const result = await callTool(body.params?.name, body.params?.arguments ?? {});
          return json({ jsonrpc: '2.0', id: body.id, result: toolResult(result) });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (error instanceof UnknownMcpToolError) return jsonRpcError(body.id, -32602, message);
          return json({ jsonrpc: '2.0', id: body.id, result: toolResult({ error: message }, true) });
        }
      }
      return jsonRpcError(body.id, -32601, `Method not found: ${body.method}`);
    }

    const tool = body?.tool ?? body?.name;
    const input = body?.input ?? body?.arguments ?? {};
    return json(await callTool(tool, input));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const auth = authError(request);
  if (auth) return json({ error: auth }, { status: auth === 'Unauthorized' ? 401 : 503 });
  return json({ tools });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
