import { beforeEach, describe, expect, it } from 'vitest';
import { GET as HEALTH_GET } from '@/app/api/health/route';
import { GET, POST } from '@/app/api/mcp/route';
import { getBatchById, resetStore } from '@/lib/store';

function request(body: unknown) {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
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
      request_context: { type: 'string' },
    });
    expect(createTool.outputSchema.properties.diagnostics).toMatchObject({
      type: 'object',
      additionalProperties: true,
    });
    expect(createTool.outputSchema.properties.diagnostics.properties.deployment.properties).toMatchObject({
      contract_revision: { type: 'string' },
    });
    expect(createTool.outputSchema.properties.processing.properties).toMatchObject({
      correlation_id: { type: 'string' },
      state: { type: 'string' },
    });
  });

  it('keeps public health diagnostics coarse', async () => {
    const previous = {
      sha: process.env.VERCEL_GIT_COMMIT_SHA,
      ref: process.env.VERCEL_GIT_COMMIT_REF,
      url: process.env.VERCEL_URL,
    };
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc123';
    process.env.VERCEL_GIT_COMMIT_REF = 'main';
    process.env.VERCEL_URL = 'outbound.example.vercel.app';

    const response = await HEALTH_GET();
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.contract_revision).toMatch(/^bdr-/);
    expect(JSON.stringify(body)).not.toContain('abc123');
    expect(JSON.stringify(body)).not.toContain('outbound.example.vercel.app');
    expect(JSON.stringify(body)).not.toContain('main');

    restoreEnv('VERCEL_GIT_COMMIT_SHA', previous.sha);
    restoreEnv('VERCEL_GIT_COMMIT_REF', previous.ref);
    restoreEnv('VERCEL_URL', previous.url);
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
    expect(body.result.structuredContent.processing.correlation_id).toMatch(/^batch-trigger-/);
    expect(body.result.structuredContent.diagnostics.deployment.contract_revision).toMatch(/^bdr-/);
    expect(JSON.parse(body.result.content[0].text).batch_id).toBe(body.result.structuredContent.batch_id);
  });

  it('supports get_outbound_sequence_status JSON-RPC tool calls through the route', async () => {
    const createResponse = await POST(request({
      jsonrpc: '2.0',
      id: 30,
      method: 'tools/call',
      params: {
        name: 'create_outbound_sequence',
        arguments: {
          actor: { email: 'status@company.com', cowork_thread_id: 'thread-status' },
          companies: [{ company_name: 'Quince', domain: 'onequince.com' }],
        },
      },
    }));
    const created = await createResponse.json();
    const batchId = created.result.structuredContent.batch_id;

    const statusResponse = await POST(request({
      jsonrpc: '2.0',
      id: 31,
      method: 'tools/call',
      params: {
        name: 'get_outbound_sequence_status',
        arguments: {
          actor: { email: 'status@company.com' },
          batch_id: batchId,
        },
      },
    }));

    expect(statusResponse.status).toBe(200);
    const body = await statusResponse.json();
    expect(body.result.isError).toBe(false);
    expect(body.result.structuredContent).toMatchObject({
      ok: true,
      batch_id: batchId,
      status: 'processing',
      poll_tool: 'get_outbound_sequence_status',
      processing: { state: 'triggered_no_runs_yet', run_count: 0 },
      run_counts: { total: 0 },
    });
    expect(JSON.parse(body.result.content[0].text).batch_id).toBe(batchId);
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

  it('infers BDR play id from BDR-confirming metadata when play_id is omitted', async () => {
    const response = await POST(request({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'create_outbound_sequence',
        arguments: {
          actor: { email: 'bdr@company.com', cowork_thread_id: 'thread-bdr' },
          play_metadata: { intake: { confirmed_play: 'bdr_cold_outbound' } },
          companies: [{ company_name: 'KiwiCo', domain: 'kiwico.com' }],
        },
      },
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.isError).toBe(false);
    expect(body.result.structuredContent.play_id).toBe('bdr_cold_outbound');
    expect(body.result.structuredContent.diagnostics.processing_route).toBe('bdr_workflow');
    expect(body.result.structuredContent.routing.source).toBe('metadata');
  });

  it('uses the server-side intake router for account sequencing requests without explicit play_id', async () => {
    const response = await POST(request({
      jsonrpc: '2.0',
      id: 71,
      method: 'tools/call',
      params: {
        name: 'create_outbound_sequence',
        arguments: {
          actor: { email: 'bdr@company.com', cowork_thread_id: 'thread-bdr' },
          request_context: 'Sequence this account for BDR outreach: Gruns / AJ, Director of Customer Experience.',
          companies: [{
            company_name: 'Gruns',
            domain: 'gruns.co',
            contacts: [{ name: 'AJ', title: 'Director of Customer Experience' }],
          }],
        },
      },
    }));

    const body = await response.json();
    expect(body.result.isError).toBe(false);
    expect(body.result.structuredContent.play_id).toBe('bdr_cold_outbound');
    expect(body.result.structuredContent.routing.source).toBe('heuristic');
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
    const customBatch = await getBatchById(customBody.result.structuredContent.batch_id);
    expect(customBatch?.play_metadata?.target_persona).toBe('CX leaders at ecommerce brands');
  });
});
