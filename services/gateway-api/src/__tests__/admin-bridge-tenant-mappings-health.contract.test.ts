import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const BRIDGE_MAPPING_ROUTE = path.resolve(__dirname, '../routes/admin/bridge-tenant-mappings.ts');

describe('admin bridge tenant mappings health contract', () => {
  it('exposes health endpoint for strict-mode readiness and invalid mapping audit', async () => {
    const source = await fs.readFile(BRIDGE_MAPPING_ROUTE, 'utf8');

    expect(source).toContain("app.get('/integrations/47dynamics/tenant-mappings/health'");
    expect(source).toContain('strict_mode_ready');
    expect(source).toContain('invalid_active_mappings');
    expect(source).toContain('issues');
  });

  it('verifies mapping integrity with chat-in-org and active-agent joins', async () => {
    const source = await fs.readFile(BRIDGE_MAPPING_ROUTE, 'utf8');

    expect(source).toContain('LEFT JOIN chats c');
    expect(source).toContain('c.organization_id = m.organization_id');
    expect(source).toContain('LEFT JOIN agents a');
    expect(source).toContain("a.status = 'active'");
    expect(source).toContain('const strictModeReady = invalidActiveMappings === 0;');
  });
});
