import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), '..', '..');

describe('Integration runtime truthfulness contract (2026-03-12)', () => {
  it('keeps integration-runtime route and orchestrator implementation files present', async () => {
    const required = [
      'services/gateway-api/src/routes/admin/integration-runtime.ts',
      'services/gateway-api/src/services/IntegrationRuntimeOrchestrator.ts',
      'services/gateway-api/src/services/IntegrationRuntimeReconciler.ts',
      'services/skill-runner/src/integration-runtime-readiness.ts',
      'services/skill-runner/src/integration-runtime-timeout.ts',
    ];

    for (const rel of required) {
      await expect(fs.access(path.join(ROOT, rel))).resolves.toBeUndefined();
    }
  });
});

