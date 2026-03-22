import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const GATEWAY_BRIDGE_WORKFLOW = path.resolve(__dirname, '../../../../.github/workflows/gateway-bridge-contract-tests.yml');

describe('gateway bridge contract workflow coverage contract', () => {
  it('runs bridge and rag integration contract tests in gateway-bridge-contract-tests workflow', async () => {
    const source = await fs.readFile(GATEWAY_BRIDGE_WORKFLOW, 'utf8');

    expect(source).toContain('services/bridge-47dynamics/**');
    expect(source).toContain('services/rag-indexer/**');

    expect(source).toContain('src/__tests__/admin-bridge-tenant-mappings-registration.contract.test.ts');
    expect(source).toContain('src/__tests__/admin-bridge-tenant-mappings-health.contract.test.ts');
    expect(source).toContain('src/__tests__/bridge-correlation-routing.contract.test.ts');
    expect(source).toContain('src/__tests__/bridge-strict-mode-env-alias.contract.test.ts');
    expect(source).toContain('src/__tests__/rag-indexer-query-path.contract.test.ts');
  });
});
