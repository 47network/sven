import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const DB_SEED = path.resolve(__dirname, '../db/seed.ts');

describe('seed allowlist baseline contract', () => {
  it('keeps baseline allowlist seed set with nas_path default for release boot invariants', async () => {
    const source = await fs.readFile(DB_SEED, 'utf8');

    expect(source).toContain("const allowlistTypes = ['nas_path', 'web_domain', 'ha_entity', 'ha_service', 'git_repo'];");
    expect(source).toContain("if (type === 'nas_path')");
    expect(source).toContain("'/nas/shared'");
    expect(source).toContain('Shared NAS folder (read-only by default)');
    expect(source).toContain("logger.info('Seeded allowlists');");
  });
});
