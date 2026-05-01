import { beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/mcp/route';
import { resetStore } from '@/lib/store';

function request(body: unknown) {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('mcp route protocol compatibility', () => {
  beforeEach(() => resetStore());

  it('lists tools with input and output schemas', async () => {
    const response = await GET(new Request('http://localhost/api/mcp'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tools.map((tool: any) => tool.name)).toEqual(['create_outbound_sequence', 'get_outbound_sequence_status']);
    const createTool = body.tools[0];
    expect(createTool.inputSchema).toBeDefined();
    expect(createTool.outputSchema).toBeDefined();
    expect(createTool.inputSchema.properties).toMatchObject({
      play_id: { type: 'string', enum: ['bdr_cold_outbound'] },
      play_metadata: { type: 'object', additionalProperties: true },
    });
  });

  it('supports initialize and tools/list JSON-RPC requests', async () => {
    const initialize = await POST(request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }));
    await expect(initialize.json()).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: { capabilities: { tools: {} }, serverInfo: { name: 'gladly-outbound-approval' } },
    });

    const list = await POST(request({ jsonrpc: '2.0', id: 2, method: 'tools/list' }));
    const body = await list.json();
    expect(body.result.tools).toHaveLength(2);
  });

  it('returns structuredContent and text content for successful tool calls', async () => {
    const response = await POST(request({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'create_outbound_sequence',
        arguments: {
          actor: { email: 'user@company.com', cowork_thread_id: 'thread-1' },
          companies: [{ company_name: 'Quince', domain: 'onequince.com' }],
        },
      },
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.isError).toBe(false);
    expect(body.result.structuredContent.batch_id).toMatch(/^batch_/);
    expect(JSON.parse(body.result.content[0].text).batch_id).toBe(body.result.structuredContent.batch_id);
  });

  it('returns known tool validation failures as MCP tool errors', async () => {
    const response = await POST(request({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'create_outbound_sequence', arguments: { actor: { email: '' }, companies: [] } },
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent.error).toMatch(/valid actor email/i);
  });

  it('keeps unknown tools as JSON-RPC protocol errors', async () => {
    const response = await POST(request({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'missing_tool', arguments: {} } }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 5,
      error: { code: -32602, message: expect.stringMatching(/Unknown MCP tool/) },
    });
  });

  it('rejects unknown play ids instead of creating generic fallback batches', async () => {
    const response = await POST(request({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'create_outbound_sequence',
        arguments: {
          actor: { email: 'bdr@company.com', cowork_thread_id: 'thread-bdr' },
          play_id: 'other_play',
          companies: [{ company_name: 'Gruns', domain: 'gruns.co' }],
        },
      },
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent.error).toMatch(/play_id/i);
  });

  it('keeps direct non-JSON-RPC tool invocation compatible', async () => {
    const response = await POST(request({
      tool: 'create_outbound_sequence',
      input: {
        actor: { email: 'direct@company.com' },
        companies: [{ company_name: 'Kizik', domain: 'kizik.com' }],
      },
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.batch_id).toMatch(/^batch_/);
  });

  it('accepts the account-sequencer BDR and fully custom route shapes', async () => {
    const bdrResponse = await POST(request({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'create_outbound_sequence',
        arguments: {
          actor: { email: 'bdr@company.com', cowork_thread_id: 'thread-bdr' },
          play_id: 'bdr_cold_outbound',
          play_metadata: {
            intake: {
              confirmed_play: 'bdr_cold_outbound',
              input_format: 'pasted_accounts',
              push_intent: 'review_first',
            },
          },
          companies: [{ company_name: 'Gruns', domain: 'gruns.co' }],
        },
      },
    }));
    const bdrBody = await bdrResponse.json();
    expect(bdrResponse.status).toBe(200);
    expect(bdrBody.result.isError).toBe(false);
    expect(bdrBody.result.structuredContent.play_id).toBe('bdr_cold_outbound');

    const customResponse = await POST(request({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'create_outbound_sequence',
        arguments: {
          actor: { email: 'custom@company.com', cowork_thread_id: 'thread-custom' },
          target_persona: 'CX leaders at ecommerce brands',
          companies: [{ company_name: 'Quince', domain: 'quince.com' }],
        },
      },
    }));
    const customBody = await customResponse.json();
    expect(customResponse.status).toBe(200);
    expect(customBody.result.isError).toBe(false);
    expect(customBody.result.structuredContent.play_id).toBeUndefined();
  });
});
