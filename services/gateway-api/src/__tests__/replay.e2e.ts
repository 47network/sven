import { describe, expect, it } from '@jest/globals';

const RUN_LIVE = process.env.RUN_LIVE_GATEWAY_E2E === 'true';
const REPLAY_E2E_REQUIRED = String(process.env.REPLAY_E2E_REQUIRED || '').trim().toLowerCase() === 'true';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';
const API_BASE = `${process.env.API_URL || 'http://localhost:3001'}/v1/admin`;

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  return { status: response.status, data };
}

describe('replay harness admin APIs', () => {
  it('lists scenario metadata endpoints', async () => {
    if (!RUN_LIVE) {
      if (REPLAY_E2E_REQUIRED) {
        throw new Error('REPLAY_E2E_REQUIRED=true requires RUN_LIVE_GATEWAY_E2E=true');
      }
      expect(true).toBe(true);
      return;
    }

    const scenarios = await call('GET', '/replay/scenarios');
    expect(scenarios.status).toBe(200);

    const categories = await call('GET', '/replay/scenarios/categories');
    expect(categories.status).toBe(200);

    const stats = await call('GET', '/replay/scenarios/stats');
    expect(stats.status).toBe(200);
  });

  it('creates and inspects a replay run when APIs are enabled', async () => {
    if (!RUN_LIVE) {
      if (REPLAY_E2E_REQUIRED) {
        throw new Error('REPLAY_E2E_REQUIRED=true requires RUN_LIVE_GATEWAY_E2E=true');
      }
      expect(true).toBe(true);
      return;
    }

    const scenarioName = `test_scenario_${Date.now()}`;
    const createdScenario = await call('POST', '/replay/scenario', {
      name: scenarioName,
      description: 'Jest replay e2e',
      category: 'test',
      chatId: '550e8c5-9f1e-4b1a-a123-00000000000a',
      userMessage: 'hello',
      expectedAssistantResponse: 'hello',
      expectedToolCalls: [],
      expectedApprovalsRequired: false,
      tags: ['test'],
      priority: 5,
    });
    expect([200, 201]).toContain(createdScenario.status);

    const scenarioId = createdScenario.data?.data?.id;
    expect(String(scenarioId || '')).not.toBe('');

    const run = await call('POST', '/replay/run', {
      name: `run-${Date.now()}`,
      description: 'Jest replay run',
      buildVersion: 'v0.1.0-test',
      scenarioIds: [scenarioId],
    });
    expect([200, 201]).toContain(run.status);

    const runId = run.data?.data?.id;
    expect(String(runId || '')).not.toBe('');

    const getRun = await call('GET', `/replay/run/${runId}`);
    expect(getRun.status).toBe(200);

    const getResults = await call('GET', `/replay/run/${runId}/results`);
    expect(getResults.status).toBe(200);

    await call('DELETE', `/replay/scenario/${scenarioId}`);
  });
});
