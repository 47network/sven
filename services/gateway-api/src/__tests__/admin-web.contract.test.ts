import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const WEB_ROUTE = path.resolve(__dirname, '../routes/admin/web.ts');

describe('admin/web route contract', () => {
  let source: string;

  beforeAll(async () => {
    source = await fs.readFile(WEB_ROUTE, 'utf8');
  });

  it('registers allowlist CRUD endpoints', () => {
    expect(source).toContain("'/web/allowlist'");
    expect(source).toMatch(/fastify\.get.*'\/web\/allowlist'/);
    expect(source).toMatch(/fastify\.post.*'\/web\/allowlist'/);
    expect(source).toMatch(/fastify\.patch.*'\/web\/allowlist\/:id'/);
    expect(source).toMatch(/fastify\.delete.*'\/web\/allowlist\/:id'/);
  });

  it('registers test-fetch endpoint with bounded timeouts', () => {
    expect(source).toContain("'/web/test-fetch'");
    expect(source).toContain('TEST_FETCH_TIMEOUT_DEFAULT_MS');
    expect(source).toContain('TEST_FETCH_TIMEOUT_MIN_MS');
    expect(source).toContain('TEST_FETCH_TIMEOUT_MAX_MS');
  });

  it('registers cache-stats endpoint', () => {
    expect(source).toContain("'/web/cache-stats'");
  });

  it('registers widget settings and instances endpoints', () => {
    expect(source).toContain("'/web/widget/settings'");
    expect(source).toContain("'/web/widget/instances'");
    expect(source).toContain("'/web/widget/embed/:instanceId'");
  });

  it('bounds content length for test-fetch', () => {
    expect(source).toContain('TEST_FETCH_MAX_CONTENT_DEFAULT_BYTES');
    expect(source).toContain('TEST_FETCH_MAX_CONTENT_MIN_BYTES');
    expect(source).toContain('TEST_FETCH_MAX_CONTENT_MAX_BYTES');
  });
});
