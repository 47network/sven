import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

describe('registry user install contract', () => {
  it('keeps the user-facing install route available to authenticated org members without tenant-admin gating', async () => {
    const source = await fs.readFile(path.resolve(__dirname, '../routes/registry.ts'), 'utf8');
    const installRouteStart = source.indexOf("app.post('/v1/registry/install/:id'");
    expect(installRouteStart).toBeGreaterThanOrEqual(0);
    const installRouteEnd = source.indexOf("app.post('/v1/registry/purchase/:id'", installRouteStart);
    expect(installRouteEnd).toBeGreaterThan(installRouteStart);
    const installRoute = source.slice(installRouteStart, installRouteEnd);

    expect(installRoute).not.toContain('requireTenantAdminForRegistryMutation');
    expect(installRoute).toContain("const trustLevel = 'quarantined'");
    expect(installRoute).toContain('installed: true');
  });
});
