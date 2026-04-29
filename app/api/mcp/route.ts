import { NextResponse } from 'next/server';
import { createOutboundSequence, getOutboundSequenceStatus } from '@/lib/mcp/outbound-tools';

function authError(request: Request) {
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
    description: 'Create and process a Gladly outbound sequence batch for a Cowork user. Requires actor.email.',
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
    description: 'Get review/status URLs and run counts for a batch visible to the actor account.',
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
  if (auth) return NextResponse.json({ error: auth }, { status: auth === 'Unauthorized' ? 401 : 503 });

  try {
    const body = await request.json();
    if (body?.jsonrpc === '2.0') {
      if (body.method === 'initialize') return NextResponse.json({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'gladly-outbound-approval', version: '0.1.0' } } });
      if (body.method === 'tools/list') return NextResponse.json({ jsonrpc: '2.0', id: body.id, result: { tools } });
      if (body.method === 'tools/call') {
        const result = await callTool(body.params?.name, body.params?.arguments ?? {});
        return NextResponse.json({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result } });
      }
      return NextResponse.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Method not found: ${body.method}` } }, { status: 400 });
    }

    const tool = body?.tool ?? body?.name;
    const input = body?.input ?? body?.arguments ?? {};
    return NextResponse.json(await callTool(tool, input));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const auth = authError(request);
  if (auth) return NextResponse.json({ error: auth }, { status: auth === 'Unauthorized' ? 401 : 503 });
  return NextResponse.json({ tools });
}
