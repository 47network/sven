import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const ADMIN_INDEX = path.resolve(__dirname, '../routes/admin/index.ts');
const INTEGRATION_RUNTIME = path.resolve(__dirname, '../routes/admin/integration-runtime.ts');
const SECRETS_PAGE = path.resolve(__dirname, '../../../../apps/admin-ui/src/app/secrets/page.tsx');

describe('admin secrets route claim W6 contract', () => {
  it('registers integration-runtime routes in admin index', async () => {
    const source = await fs.readFile(ADMIN_INDEX, 'utf8');
    expect(source).toContain('registerIntegrationRuntimeRoutes');
  });

  it('exposes GET and PUT config endpoints for integration runtime', async () => {
    const source = await fs.readFile(INTEGRATION_RUNTIME, 'utf8');
    expect(source).toContain("app.get('/integrations/runtime/:integrationType'");
    expect(source).toContain("app.put('/integrations/runtime/:integrationType/config'");
  });

  it('has a secrets UI page in admin-ui', async () => {
    const exists = await fs.access(SECRETS_PAGE).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});
