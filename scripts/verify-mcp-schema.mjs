#!/usr/bin/env node

const rawUrl = process.argv[2] ?? process.env.MCP_URL ?? process.env.APP_BASE_URL;
if (!rawUrl) {
  console.error('MCP URL is required. Pass a URL or set MCP_URL or APP_BASE_URL.');
  process.exit(1);
}

function normalizeEndpoint(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('unsupported protocol');
    if (!parsed.pathname.endsWith('/api/mcp')) parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}/api/mcp`;
    return parsed.toString();
  } catch {
    console.error(`MCP URL must be an absolute http(s) URL, got: ${value}`);
    console.error('Set APP_BASE_URL to your deployed app URL, for example: APP_BASE_URL="https://your-app.vercel.app"');
    process.exit(1);
  }
}

const endpoint = normalizeEndpoint(rawUrl);
const healthEndpoint = new URL('/api/health', endpoint).toString();

const headers = { 'content-type': 'application/json' };
if (process.env.MCP_API_SECRET) {
  headers.authorization = `Bearer ${process.env.MCP_API_SECRET}`;
}

async function parseJsonResponse(response, label) {
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} did not return JSON (${response.status}): ${text.slice(0, 160)}`);
  }
  if (!response.ok) {
    const message = body?.error?.message ?? body?.error ?? response.statusText;
    const authHint = response.status === 401 || response.status === 403
      ? ' Check MCP_API_SECRET for protected deployments.'
      : '';
    throw new Error(`${label} failed (${response.status}): ${message}.${authHint}`);
  }
  return body;
}

function extractTools(body, label) {
  const tools = body?.tools ?? body?.result?.tools;
  if (!Array.isArray(tools)) throw new Error(`${label} response did not include a tools array.`);
  return tools;
}

function assertCreateToolContract(tools, label) {
  const createTool = tools.find((tool) => tool?.name === 'create_outbound_sequence');
  if (!createTool) throw new Error(`${label} is missing create_outbound_sequence.`);

  const properties = createTool.inputSchema?.properties ?? {};
  const playId = properties.play_id;
  const playMetadata = properties.play_metadata;

  if (!playId) throw new Error(`${label} create_outbound_sequence is missing play_id.`);
  if (!Array.isArray(playId.enum) || !playId.enum.includes('bdr_cold_outbound')) {
    throw new Error(`${label} play_id does not allow bdr_cold_outbound.`);
  }
  if (!playMetadata || playMetadata.type !== 'object') {
    throw new Error(`${label} create_outbound_sequence is missing object play_metadata.`);
  }
  const diagnostics = createTool.outputSchema?.properties?.diagnostics;
  if (!diagnostics?.properties?.deployment?.properties?.contract_revision) {
    throw new Error(`${label} create_outbound_sequence output diagnostics are missing deployment.contract_revision.`);
  }
}

function assertHealthContract(body) {
  if (!body?.contract_revision) throw new Error(`GET /api/health is missing contract_revision.`);
  return body.contract_revision;
}

async function fetchDirectTools() {
  const response = await fetch(endpoint, { headers });
  return parseJsonResponse(response, 'GET /api/mcp');
}

async function fetchJsonRpcTools() {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 'verify-mcp-schema', method: 'tools/list' }),
  });
  return parseJsonResponse(response, 'JSON-RPC tools/list');
}

async function fetchHealth() {
  const response = await fetch(healthEndpoint, { headers });
  return parseJsonResponse(response, 'GET /api/health');
}

try {
  const health = await fetchHealth();
  const contractRevision = assertHealthContract(health);

  const direct = await fetchDirectTools();
  assertCreateToolContract(extractTools(direct, 'GET /api/mcp'), 'GET /api/mcp');

  const rpc = await fetchJsonRpcTools();
  assertCreateToolContract(extractTools(rpc, 'JSON-RPC tools/list'), 'JSON-RPC tools/list');

  console.log(`MCP schema OK: ${endpoint} exposes play_id and play_metadata for create_outbound_sequence. contract_revision=${contractRevision}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
