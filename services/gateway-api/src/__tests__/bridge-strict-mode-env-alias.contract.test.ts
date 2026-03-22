import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const BRIDGE_INDEX = path.resolve(__dirname, '../../../bridge-47dynamics/src/index.ts');

describe('bridge strict-mode env alias contract', () => {
  it('accepts canonical and legacy strict-mode env vars for tenant mapping enforcement', async () => {
    const source = await fs.readFile(BRIDGE_INDEX, 'utf8');

    expect(source).toContain("process.env['BRIDGE_REQUIRE_TENANT_MAPPING']");
    expect(source).toContain("process.env['SVEN_BRIDGE_REQUIRE_TENANT_MAPPING']");
    expect(source).toContain("requireTenantMapping: ['1', 'true', 'yes', 'on'].includes(tenantMappingStrictRaw)");
  });
});
