import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const GIT_ROUTE = path.resolve(__dirname, '../routes/admin/git.ts');

describe('admin/git route contract', () => {
  let source: string;

  beforeAll(async () => {
    source = await fs.readFile(GIT_ROUTE, 'utf8');
  });

  it('registers CRUD endpoints for git repos', () => {
    expect(source).toContain("'/git/repos'");
    expect(source).toMatch(/fastify\.get.*'\/git\/repos'/);
    expect(source).toMatch(/fastify\.post.*'\/git\/repos'/);
    expect(source).toMatch(/fastify\.delete.*'\/git\/repos\/:id'/);
  });

  it('registers repo status and sync endpoints', () => {
    expect(source).toContain("'/git/repos/:id/status'");
    expect(source).toContain("'/git/repos/:id/sync'");
  });

  it('registers pull request endpoints', () => {
    expect(source).toContain("'/git/repos/:id/pull-requests'");
  });

  it('validates git provider against allowlist', () => {
    expect(source).toContain('ALLOWED_GIT_PROVIDERS');
    expect(source).toContain("'local'");
    expect(source).toContain("'forgejo'");
    expect(source).toContain("'github'");
  });

  it('validates merge strategy against allowlist', () => {
    expect(source).toContain('ALLOWED_MERGE_STRATEGIES');
  });

  it('uses safe column projection for repo queries', () => {
    expect(source).toContain('GIT_REPO_SAFE_PROJECTION');
  });

  it('uses resolveSecretRef for credential handling', () => {
    expect(source).toContain('resolveSecretRef');
  });
});
