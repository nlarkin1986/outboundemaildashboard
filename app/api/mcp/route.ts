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

const tools = [
  {
    name: 'create_outbound_sequence',
    description: 'Create a Gladly outbound sequence batch for a Cowork user. Returns immediately with a durable batch_id, dashboard URL, review URL, and polling instructions. If status is queued, processing, or pushing, call get_outbound_sequence_status after recommended_poll_after_seconds until terminal/action state. Requires actor.email.',
    inputSchema: {
      type: 'object',
      required: ['actor', 'companies'],
      properties: {
        actor: { type: 'object', required: ['email'], properties: { email: { type: 'string' }, name: { type: 'string' }, cowork_user_id: { type: 'string' }, cowork_org_id: { type: 'string' }, cowork_thread_id: { type: 'string' } } },
        companies: { type: 'array', items: { type: 'object', required: ['company_name'], properties: { company_name: { type: 'string' }, domain: { type: 'string' }, contacts: { type: 'array' } } } },
        mode: { type: 'string', enum: ['fast', 'deep'] },
        target_persona: { type: 'string' },
        campaign_id: { type: ['string', 'null'] },
      },
    },
  },
  {
    name: 'get_outbound_sequence_status',
    description: 'Poll a Gladly outbound sequence batch by batch_id. Use this after create_outbound_sequence. Follow cowork_next_action and recommended_poll_after_seconds until ready_for_review, partially_failed, failed, review_submitted, or pushed.',
    inputSchema: {
      type: 'object',
      required: ['batch_id', 'actor'],
      properties: { batch_id: { type: 'string' }, actor: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } } },
    },
  },
];

async function callTool(name: string, input: unknown) {
  if (name === 'create_outbound_sequence') return createOutboundSequence(input as any);
  if (name === 'get_outbound_sequence_status') return getOutboundSequenceStatus(input as any);
  throw new Error(`Unknown MCP tool: ${name || 'missing'}`);
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
        const result = await callTool(body.params?.name, body.params?.arguments ?? {});
        return json({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result } });
      }
      return json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Method not found: ${body.method}` } }, { status: 400 });
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
