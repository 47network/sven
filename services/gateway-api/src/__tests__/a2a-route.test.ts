import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const A2A_ROUTE = path.resolve(__dirname, '../routes/a2a.ts');

describe('a2a route contract', () => {
  it('registers /v1/a2a route with API-key auth and bounded rate limiting', async () => {
    const source = await fs.readFile(A2A_ROUTE, 'utf8');

    expect(source).toContain("app.post('/v1/a2a'");
    expect(source).toContain("code: 'INVALID_A2A_API_KEY'");
    expect(source).toContain("code: 'A2A_RATE_LIMITED'");
    expect(source).toContain('A2A_RATE_LIMIT_WINDOW_MS');
    expect(source).toContain('A2A_RATE_LIMIT_MAX_REQUESTS');
  });

  it('keeps status/tools-list/forward safeguards for tenant-aware operation', async () => {
    const source = await fs.readFile(A2A_ROUTE, 'utf8');

    expect(source).toContain("if (action === 'status')");
    expect(source).toContain("actions_supported: ['status', 'echo', 'tools.list']");
    expect(source).toContain("if (action === 'tools.list')");
    expect(source).toContain("code: 'A2A_ORG_CONTEXT_REQUIRED'");
    expect(source).toContain('SVEN_A2A_FORWARD_ALLOWLIST_HOSTS');
    expect(source).toContain("code: 'A2A_FORWARD_PEER_HOST_FORBIDDEN'");
  });
});
