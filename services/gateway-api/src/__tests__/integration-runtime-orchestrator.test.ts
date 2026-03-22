import { describe, expect, it } from '@jest/globals';
import { IntegrationRuntimeOrchestrator } from '../services/IntegrationRuntimeOrchestrator';

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    prev[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return fn().finally(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

describe('IntegrationRuntimeOrchestrator', () => {
  it('executes deploy hooks when enabled', async () => {
    const cmd = `"${process.execPath}" -e "process.exit(0)"`;
    await withEnv(
      {
        SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED: 'true',
        SVEN_INTEGRATION_DEPLOY_CMD_TEMPLATE: cmd,
      },
      async () => {
        const orchestrator = new IntegrationRuntimeOrchestrator();
        const result = await orchestrator.execute({
          action: 'deploy',
          integrationType: 'obsidian',
          organizationId: 'org-test',
          runtimeMode: 'container',
          imageRef: 'sven/integration-obsidian:latest',
          storagePath: '/tmp/obsidian',
          networkScope: 'sven-org-test',
        });
        expect(result.executed).toBe(true);
        expect(result.ok).toBe(true);
        expect(result.configured).toBe(true);
      },
    );
  });

  it('returns configured=false when no hook command is configured', async () => {
    await withEnv(
      {
        SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED: 'true',
        SVEN_INTEGRATION_DEPLOY_CMD_TEMPLATE: undefined,
      },
      async () => {
        const orchestrator = new IntegrationRuntimeOrchestrator();
        const result = await orchestrator.execute({
          action: 'deploy',
          integrationType: 'obsidian',
          organizationId: 'org-test',
          runtimeMode: 'container',
        });
        expect(result.executed).toBe(false);
        expect(result.ok).toBe(false);
        expect(result.configured).toBe(false);
      },
    );
  });

  it('classifies hung command termination as explicit runtime timeout', async () => {
    const cmd = `"${process.execPath}" -e "setInterval(()=>{},1000)"`;
    await withEnv(
      {
        SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED: 'true',
        SVEN_INTEGRATION_RUNTIME_EXEC_TIMEOUT_MS: '5000',
        SVEN_INTEGRATION_RUNTIME_EXEC_KILL_GRACE_MS: '500',
        SVEN_INTEGRATION_DEPLOY_CMD_TEMPLATE: cmd,
      },
      async () => {
        const orchestrator = new IntegrationRuntimeOrchestrator();
        const startedAt = Date.now();
        const result = await orchestrator.execute({
          action: 'deploy',
          integrationType: 'obsidian',
          organizationId: 'org-test',
          runtimeMode: 'container',
        });
        const elapsedMs = Date.now() - startedAt;

        expect(result.executed).toBe(true);
        expect(result.ok).toBe(false);
        expect(String(result.error || '')).toContain('RUNTIME_CMD_TIMEOUT');
        expect(elapsedMs).toBeLessThan(10_000);
      },
    );
  }, 20000);
});
