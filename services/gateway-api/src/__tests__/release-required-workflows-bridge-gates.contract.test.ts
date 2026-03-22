import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const REQUIRED_WORKFLOWS_MANIFEST = path.resolve(__dirname, '../../../../config/release/required-workflows.json');

describe('release required workflows bridge gate contract', () => {
  it('keeps bridge runtime and gateway bridge contract workflows in required release workflow manifest', async () => {
    const source = await fs.readFile(REQUIRED_WORKFLOWS_MANIFEST, 'utf8');
    const parsed = JSON.parse(source) as { required_workflows?: string[] };
    const required = Array.isArray(parsed.required_workflows) ? parsed.required_workflows : [];

    expect(required).toContain('bridge-runtime-tests');
    expect(required).toContain('gateway-bridge-contract-tests');
  });
});
