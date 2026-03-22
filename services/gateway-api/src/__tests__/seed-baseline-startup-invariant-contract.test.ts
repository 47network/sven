import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const GATEWAY_INDEX = path.resolve(__dirname, '../index.ts');

describe('seed baseline startup invariant contract', () => {
  it('keeps seed baseline invariant query and fail-closed message for hardened/production startup', async () => {
    const source = await fs.readFile(GATEWAY_INDEX, 'utf8');

    expect(source).toContain('async function verifySeedBaselineInvariant');
    expect(source).toContain("EXISTS(SELECT 1 FROM users WHERE username = '47') AS has_admin_47");
    expect(source).toContain("EXISTS(SELECT 1 FROM chats WHERE type = 'hq') AS has_hq_chat");
    expect(source).toContain("if (!row.has_nas_seed_allowlist) missing.push('allowlists(nas_path=/nas/shared)');");
    expect(source).toContain('seed baseline invariant missing:');
    expect(source).toContain('Run migrations + seed before starting release-grade gateway.');
  });

  it('preserves enforcement gate and non-production warning fallback', async () => {
    const source = await fs.readFile(GATEWAY_INDEX, 'utf8');

    expect(source).toContain('function isSeedBaselineEnforced');
    expect(source).toContain('SVEN_ENFORCE_SEED_BASELINE');
    expect(source).toContain('await verifySeedBaselineInvariant(pool);');
    expect(source).toContain('if (isSeedBaselineEnforced(process.env)) {');
    expect(source).toContain("logger.warn('Seed baseline invariant check failed (non-blocking in non-production profile)'");
  });
});
