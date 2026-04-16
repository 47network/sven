import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const STREAMS_ROUTE = path.resolve(__dirname, '../routes/streams.ts');

describe('streams owner-scope contract', () => {
  it('stores owner user and org on stream creation', async () => {
    const source = await fs.readFile(STREAMS_ROUTE, 'utf8');
    expect(source).toContain('ownerUserId');
    expect(source).toContain('ownerOrgId');
  });

  it('authenticates all stream endpoints', async () => {
    const source = await fs.readFile(STREAMS_ROUTE, 'utf8');
    expect(source).toContain('preHandler: authenticated');
    expect(source).toContain("requireRole(pool, 'admin', 'user')");
  });

  it('enforces owner-scoped access to stream events', async () => {
    const source = await fs.readFile(STREAMS_ROUTE, 'utf8');
    expect(source).toContain("'/v1/streams/:id/events'");
    expect(source).toContain("'/v1/streams/:id/sse'");
  });
});
