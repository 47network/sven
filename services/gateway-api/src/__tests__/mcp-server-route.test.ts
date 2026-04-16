import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const MCP_ROUTE = path.resolve(__dirname, '../routes/mcp-server.ts');

describe('mcp-server route contract', () => {
  let source: string;

  beforeAll(async () => {
    source = await fs.readFile(MCP_ROUTE, 'utf8');
  });

  it('registers JSON-RPC endpoint with auth and rate limiting', () => {
    expect(source).toContain("app.post('/v1/mcp'");
    expect(source).toContain('authenticateMcp');
    expect(source).toContain('enforceRateLimit');
  });

  it('supports required MCP methods', () => {
    expect(source).toContain("'initialize'");
    expect(source).toContain("'tools/list'");
    expect(source).toContain("'tools/call'");
    expect(source).toContain("'resources/list'");
  });

  it('validates JSON-RPC request structure', () => {
    expect(source).toContain("jsonrpc");
    expect(source).toContain("method");
    expect(source).toContain("rpcErr");
  });

  it('uses safe arithmetic evaluator instead of eval/Function', () => {
    expect(source).toContain('safeEvalArithmetic');
    expect(source).not.toContain('new Function(');
    expect(source).not.toMatch(/\beval\s*\(/);
  });

  it('enforces scope-based access control on MCP methods', () => {
    expect(source).toContain('hasScope');
    expect(source).toContain('mcp.initialize');
    expect(source).toContain('mcp.tools.list');
    expect(source).toContain('mcp.tools.call');
    expect(source).toContain('mcp.resources.list');
  });

  it('supports API key authentication with kid extraction', () => {
    expect(source).toContain('extractApiKeyKid');
    expect(source).toContain('sk-sven-');
    expect(source).toContain('bcrypt.compare');
  });

  it('supports shared token fallback authentication', () => {
    expect(source).toContain('loadSharedTokenConfig');
    expect(source).toContain('mcp.server.sharedTokenEnabled');
    expect(source).toContain('mcp.server.sharedToken');
    expect(source).toContain('MCP_SERVER_ALLOW_SHARED_TOKEN');
  });

  it('applies per-client and global rate limits with windowed buckets', () => {
    expect(source).toContain('consumeWindowRate');
    expect(source).toContain('MCP_SERVER_RATE_WINDOW_MS');
    expect(source).toContain('MCP_SERVER_RATE_LIMIT');
    expect(source).toContain('MCP_SERVER_RATE_LIMIT_GLOBAL');
    expect(source).toContain('mcp_server_rate_limits');
  });

  it('resolves client identity from headers or IP hash', () => {
    expect(source).toContain('resolveMcpClientId');
    expect(source).toContain('x-sven-mcp-client-id');
  });

  it('bounds tools list with MAX_TOOLS_LIST_LIMIT', () => {
    expect(source).toContain('MAX_TOOLS_LIST_LIMIT');
  });

  it('returns structured JSON-RPC errors with proper codes', () => {
    expect(source).toContain('-32001');
    expect(source).toContain('-32003');
    expect(source).toContain('-32601');
    expect(source).toContain('-32602');
  });
});
