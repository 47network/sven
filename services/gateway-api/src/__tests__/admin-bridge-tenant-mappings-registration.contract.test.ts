import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const ADMIN_INDEX = path.resolve(__dirname, '../routes/admin/index.ts');
const BRIDGE_MAPPING_ROUTE = path.resolve(__dirname, '../routes/admin/bridge-tenant-mappings.ts');

describe('admin bridge tenant mapping registration contract', () => {
  it('registers bridge tenant mapping routes on the admin surface', async () => {
    const source = await fs.readFile(ADMIN_INDEX, 'utf8');

    expect(source).toContain("import { registerBridgeTenantMappingRoutes } from './bridge-tenant-mappings.js';");
    expect(source).toContain('await mountAdminRoutes((scopedApp) => registerBridgeTenantMappingRoutes(scopedApp, pool));');
  });

  it('enforces platform-admin boundaries for wildcard and cross-org mapping writes', async () => {
    const source = await fs.readFile(BRIDGE_MAPPING_ROUTE, 'utf8');

    expect(source).toContain("if (externalTenantId === '*' && !isPlatformAdmin(request)) {");
    expect(source).toContain('Wildcard mappings require platform admin privileges');
    expect(source).toContain('Cross-organization mapping changes require platform admin privileges');
  });
});
