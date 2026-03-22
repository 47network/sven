import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const MCP_SERVER_TOKEN = process.env.TEST_MCP_SERVER_TOKEN || process.env.SVEN_MCP_SERVER_TOKEN || '';
const LIVE_REQUIRED = String(process.env.RUN_LIVE_GATEWAY_E2E || '').trim().toLowerCase() === 'true';
const PARITY_REQUIRED = String(process.env.PARITY_E2E_REQUIRED || '').trim().toLowerCase() === 'true';

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  cookie?: string,
  extraHeaders?: Record<string, string>,
): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const parsedUrl = new URL(url);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    if (extraHeaders) {
      Object.assign(headers, extraHeaders);
    }

    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
      },
      (res) => {
        let payload = '';
        res.on('data', (chunk) => (payload += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 0, data: payload ? JSON.parse(payload) : {} });
          } catch {
            resolve({ statusCode: res.statusCode || 0, data: { raw: payload } });
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(1500, () => {
      req.destroy(new Error('request timeout'));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function isApiReachable(): Promise<boolean> {
  try {
    const res = await apiCall('GET', '/healthz');
    return res.statusCode === 200;
  } catch {
    return false;
  }
}

function skipOptionalUnlessLive(reason: string): boolean {
  if (LIVE_REQUIRED) {
    throw new Error(reason);
  }
  return true;
}

describe('MCP Admin API', () => {
  it('enforces live prereq contract when parity gating is required', async () => {
    if (!PARITY_REQUIRED) {
      return;
    }
    expect(LIVE_REQUIRED).toBe(true);
    expect(TEST_SESSION_COOKIE).not.toBe('');
    expect(MCP_SERVER_TOKEN).not.toBe('');
  });

  it('supports MCP server endpoint compatibility (optional)', async () => {
    if (!(await isApiReachable())) {
      if (skipOptionalUnlessLive('mcp.e2e requires reachable API when RUN_LIVE_GATEWAY_E2E=true')) return;
    }
    if (!MCP_SERVER_TOKEN) {
      if (skipOptionalUnlessLive('mcp.e2e requires MCP server token when RUN_LIVE_GATEWAY_E2E=true')) return;
    }

    const authHeaders = { Authorization: `Bearer ${MCP_SERVER_TOKEN}` };

    const getTools = await apiCall('GET', '/v1/mcp?limit=25', undefined, undefined, authHeaders);
    expect(getTools.statusCode).toBe(200);
    expect(Array.isArray(getTools.data?.result?.tools)).toBe(true);

    const initialize = await apiCall(
      'POST',
      '/v1/mcp',
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      undefined,
      authHeaders,
    );
    expect(initialize.statusCode).toBe(200);
    expect(initialize.data?.result?.serverInfo?.name).toBe('sven-gateway-mcp');

    const list = await apiCall(
      'POST',
      '/v1/mcp',
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      undefined,
      authHeaders,
    );
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.data?.result?.tools)).toBe(true);

    const call = await apiCall(
      'POST',
      '/v1/mcp',
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'sven.time.now', arguments: {} },
      },
      undefined,
      authHeaders,
    );
    expect(call.statusCode).toBe(200);
    expect(Array.isArray(call.data?.result?.content)).toBe(true);
  });

  it('requires auth for mcp server listing', async () => {
    if (!(await isApiReachable())) {
      if (skipOptionalUnlessLive('mcp.e2e requires reachable API when RUN_LIVE_GATEWAY_E2E=true')) return;
    }
    const res = await apiCall('GET', '/v1/admin/mcp-servers');
    expect([401, 403]).toContain(res.statusCode);
  });

  it('supports create/test/tools/call flow with mock remote MCP server (optional)', async () => {
    if (!(await isApiReachable())) {
      if (skipOptionalUnlessLive('mcp.e2e requires reachable API when RUN_LIVE_GATEWAY_E2E=true')) return;
    }
    if (!TEST_SESSION_COOKIE) {
      if (skipOptionalUnlessLive('mcp.e2e requires TEST_SESSION_COOKIE when RUN_LIVE_GATEWAY_E2E=true')) return;
    }

    const mockServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += String(chunk)));
      req.on('end', () => {
        const payload = body ? JSON.parse(body) : {};
        const method = payload?.method;
        let result: any = {};
        if (method === 'initialize') {
          result = { capabilities: { tools: {}, resources: {} } };
        } else if (method === 'tools/list') {
          result = { tools: [{ name: 'echo', description: 'Echo tool', inputSchema: { type: 'object' } }] };
        } else if (method === 'resources/list') {
          result = { resources: [{ uri: 'mcp://example/resource-1', name: 'Resource 1' }] };
        } else if (method === 'tools/call') {
          result = { content: [{ type: 'text', text: JSON.stringify(payload?.params || {}) }] };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: payload?.id || '1', result }));
      });
    });

    await new Promise<void>((resolve) => mockServer.listen(0, '127.0.0.1', () => resolve()));
    const addr = mockServer.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const url = `http://127.0.0.1:${port}`;
    const serverName = `mcp-test-${Date.now()}`;

    try {
      const created = await apiCall(
        'POST',
        '/v1/admin/mcp-servers',
        { name: serverName, transport: 'http', url },
        TEST_SESSION_COOKIE,
      );
      expect(created.statusCode).toBe(201);
      const serverId = created.data?.data?.id;
      expect(typeof serverId).toBe('string');

      const tested = await apiCall('POST', `/v1/admin/mcp-servers/${encodeURIComponent(serverId)}/test`, undefined, TEST_SESSION_COOKIE);
      expect(tested.statusCode).toBe(200);
      expect(tested.data?.success).toBe(true);

      const tools = await apiCall('GET', `/v1/admin/mcp-servers/${encodeURIComponent(serverId)}/tools`, undefined, TEST_SESSION_COOKIE);
      expect(tools.statusCode).toBe(200);
      expect(Array.isArray(tools.data?.data)).toBe(true);

      const called = await apiCall(
        'POST',
        `/v1/admin/mcp-servers/${encodeURIComponent(serverId)}/tools/call`,
        { tool_name: 'echo', input: { msg: 'hello' } },
        TEST_SESSION_COOKIE,
      );
      expect(called.statusCode).toBe(200);
      expect(called.data?.success).toBe(true);

      const callsAfterSuccess = await apiCall(
        'GET',
        `/v1/admin/mcp-tool-calls?server_id=${encodeURIComponent(serverId)}&limit=20`,
        undefined,
        TEST_SESSION_COOKIE,
      );
      expect(callsAfterSuccess.statusCode).toBe(200);
      expect(Array.isArray(callsAfterSuccess.data?.data)).toBe(true);
      const successLog = callsAfterSuccess.data.data.find((r: any) => r.tool_name === 'echo' && r.status === 'success');
      expect(Boolean(successLog)).toBe(true);

      const blockPolicy = await apiCall(
        'PUT',
        `/v1/admin/settings/${encodeURIComponent('mcp.policy.block_all')}`,
        { value: true },
        TEST_SESSION_COOKIE,
      );
      expect([200, 201]).toContain(blockPolicy.statusCode);

      const blocked = await apiCall(
        'POST',
        `/v1/admin/mcp-servers/${encodeURIComponent(serverId)}/tools/call`,
        { tool_name: 'echo', input: { msg: 'blocked' } },
        TEST_SESSION_COOKIE,
      );
      expect(blocked.statusCode).toBe(400);
      expect(String(blocked.data?.error?.message || '')).toMatch(/denied by policy/i);

      const unblockPolicy = await apiCall(
        'PUT',
        `/v1/admin/settings/${encodeURIComponent('mcp.policy.block_all')}`,
        { value: false },
        TEST_SESSION_COOKIE,
      );
      expect([200, 201]).toContain(unblockPolicy.statusCode);

      const callsAfterBlock = await apiCall(
        'GET',
        `/v1/admin/mcp-tool-calls?server_id=${encodeURIComponent(serverId)}&status=error&limit=20`,
        undefined,
        TEST_SESSION_COOKIE,
      );
      expect(callsAfterBlock.statusCode).toBe(200);
      const errorLog = (callsAfterBlock.data?.data || []).find((r: any) => r.tool_name === 'echo' && r.status === 'error');
      expect(Boolean(errorLog)).toBe(true);

      const deleted = await apiCall('DELETE', `/v1/admin/mcp-servers/${encodeURIComponent(serverId)}`, undefined, TEST_SESSION_COOKIE);
      expect(deleted.statusCode).toBe(200);
    } finally {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
  });

  it('supports local stdio MCP servers (optional)', async () => {
    if (!(await isApiReachable())) {
      if (skipOptionalUnlessLive('mcp.e2e requires reachable API when RUN_LIVE_GATEWAY_E2E=true')) return;
    }
    if (!TEST_SESSION_COOKIE) {
      if (skipOptionalUnlessLive('mcp.e2e requires TEST_SESSION_COOKIE when RUN_LIVE_GATEWAY_E2E=true')) return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sven-mcp-stdio-'));
    const scriptPath = path.join(tmpDir, 'mock-mcp-stdio.cjs');
    fs.writeFileSync(
      scriptPath,
      [
        "const readline = require('node:readline');",
        "const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });",
        "rl.on('line', (line) => {",
        "  let req;",
        "  try { req = JSON.parse(line); } catch { return; }",
        "  let result = {};",
        "  if (req.method === 'initialize') result = { capabilities: { tools: {}, resources: {} } };",
        "  else if (req.method === 'tools/list') result = { tools: [{ name: 'echo', description: 'Echo', inputSchema: { type: 'object' } }] };",
        "  else if (req.method === 'resources/list') result = { resources: [{ uri: 'mcp://local/resource', name: 'Local' }] };",
        "  else if (req.method === 'tools/call') result = { content: [{ type: 'text', text: JSON.stringify(req.params || {}) }] };",
        "  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\\n');",
        "});",
      ].join('\n'),
      'utf8',
    );

    const serverName = `mcp-stdio-${Date.now()}`;
    const stdioUrl = `node "${scriptPath}"`;
    let serverId = '';
    try {
      const created = await apiCall(
        'POST',
        '/v1/admin/mcp-servers',
        { name: serverName, transport: 'stdio', url: stdioUrl },
        TEST_SESSION_COOKIE,
      );
      expect(created.statusCode).toBe(201);
      serverId = String(created.data?.data?.id || '');
      expect(serverId).toBeTruthy();

      const tested = await apiCall(
        'POST',
        `/v1/admin/mcp-servers/${encodeURIComponent(serverId)}/test`,
        undefined,
        TEST_SESSION_COOKIE,
      );
      expect(tested.statusCode).toBe(200);
      expect(Array.isArray(tested.data?.data?.tools)).toBe(true);

      const called = await apiCall(
        'POST',
        `/v1/admin/mcp-servers/${encodeURIComponent(serverId)}/tools/call`,
        { tool_name: 'echo', input: { msg: 'hello-stdio' } },
        TEST_SESSION_COOKIE,
      );
      expect(called.statusCode).toBe(200);
      expect(called.data?.success).toBe(true);
    } finally {
      if (serverId) {
        await apiCall('DELETE', `/v1/admin/mcp-servers/${encodeURIComponent(serverId)}`, undefined, TEST_SESSION_COOKIE);
      }
      try {
        fs.unlinkSync(scriptPath);
        fs.rmdirSync(tmpDir);
      } catch {
        // Ignore test cleanup errors.
      }
    }
  });

  it('supports per-chat overrides and catalog resolution (optional)', async () => {
    if (!(await isApiReachable())) {
      if (skipOptionalUnlessLive('mcp.e2e requires reachable API when RUN_LIVE_GATEWAY_E2E=true')) return;
    }
    if (!TEST_SESSION_COOKIE) {
      if (skipOptionalUnlessLive('mcp.e2e requires TEST_SESSION_COOKIE when RUN_LIVE_GATEWAY_E2E=true')) return;
    }

    const chats = await apiCall('GET', '/v1/admin/chats', undefined, TEST_SESSION_COOKIE);
    const chatId = chats.data?.rows?.[0]?.id;
    const servers = await apiCall('GET', '/v1/admin/mcp-servers', undefined, TEST_SESSION_COOKIE);
    const serverId = servers.data?.data?.[0]?.id;
    if (!chatId || !serverId) {
      if (skipOptionalUnlessLive('mcp.e2e requires existing chat and mcp server when RUN_LIVE_GATEWAY_E2E=true')) return;
    }

    const put = await apiCall(
      'PUT',
      `/v1/admin/mcp-chat-overrides/${encodeURIComponent(chatId)}/${encodeURIComponent(serverId)}`,
      { enabled: true },
      TEST_SESSION_COOKIE,
    );
    expect(put.statusCode).toBe(200);

    const list = await apiCall(
      'GET',
      `/v1/admin/mcp-chat-overrides?chat_id=${encodeURIComponent(chatId)}`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.data?.data)).toBe(true);

    const catalog = await apiCall(
      'GET',
      `/v1/admin/mcp-catalog?chat_id=${encodeURIComponent(chatId)}`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    expect(catalog.statusCode).toBe(200);
    expect(Array.isArray(catalog.data?.data)).toBe(true);
  });
});
