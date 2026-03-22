import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const LIVE_REQUIRED = String(process.env.RUN_LIVE_GATEWAY_E2E || '').trim().toLowerCase() === 'true';
const PARITY_REQUIRED = String(process.env.PARITY_E2E_REQUIRED || '').trim().toLowerCase() === 'true';

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  cookie?: string,
): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const parsedUrl = new URL(url);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;

    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
      },
      (res) => {
        let payload = '';
        res.on('data', (chunk) => (payload += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 0, data: payload ? JSON.parse(payload) : {} });
          } catch {
            resolve({ statusCode: res.statusCode || 0, data: { raw: payload } });
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(1500, () => {
      req.destroy(new Error('request timeout'));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function isApiReachable(): Promise<boolean> {
  try {
    const res = await apiCall('GET', '/healthz');
    return res.statusCode === 200;
  } catch {
    return false;
  }
}

function skipOptionalUnlessLive(reason: string): boolean {
  if (LIVE_REQUIRED) {
    throw new Error(reason);
  }
  return true;
}

describe('Agents API', () => {
  it('enforces live prereq contract when parity gating is required', async () => {
    if (!PARITY_REQUIRED) {
      return;
    }
    expect(LIVE_REQUIRED).toBe(true);
    expect(TEST_SESSION_COOKIE).not.toBe('');
  });

  it('requires auth for agents list', async () => {
    if (!(await isApiReachable())) {
      if (skipOptionalUnlessLive('agents.e2e requires reachable API when RUN_LIVE_GATEWAY_E2E=true')) return;
    }
    const res = await apiCall('GET', '/v1/admin/agents');
    expect([401, 403]).toContain(res.statusCode);
  });

  it('supports create/list/spawn/send/history/destroy flow (optional)', async () => {
    if (!(await isApiReachable())) {
      if (skipOptionalUnlessLive('agents.e2e requires reachable API when RUN_LIVE_GATEWAY_E2E=true')) return;
    }
    if (!TEST_SESSION_COOKIE) {
      if (skipOptionalUnlessLive('agents.e2e requires TEST_SESSION_COOKIE when RUN_LIVE_GATEWAY_E2E=true')) return;
    }
    const aName = `a-${Date.now()}-1`;
    const bName = `a-${Date.now()}-2`;

    const createA = await apiCall('POST', '/v1/admin/agents', { name: aName, workspace_path: `/tmp/${aName}` }, TEST_SESSION_COOKIE);
    const createB = await apiCall('POST', '/v1/admin/agents', { name: bName, workspace_path: `/tmp/${bName}` }, TEST_SESSION_COOKIE);
    expect(createA.statusCode).toBe(201);
    expect(createB.statusCode).toBe(201);

    const agentA = createA.data?.data?.id;
    const agentB = createB.data?.data?.id;
    expect(typeof agentA).toBe('string');
    expect(typeof agentB).toBe('string');

    const spawnA = await apiCall('POST', `/v1/admin/agents/${encodeURIComponent(agentA)}/spawn-session`, { session_name: `${aName}-session` }, TEST_SESSION_COOKIE);
    const sessionId = spawnA.data?.data?.session_id;
    expect(spawnA.statusCode).toBe(201);
    expect(typeof sessionId).toBe('string');

    const attachB = await apiCall('POST', `/v1/admin/agents/${encodeURIComponent(agentB)}/spawn-session`, { session_name: `${bName}-session` }, TEST_SESSION_COOKIE);
    expect([201, 200]).toContain(attachB.statusCode);
    const sessionIdB = attachB.data?.data?.session_id;

    const routeA = await apiCall(
      'POST',
      `/v1/admin/agents/sessions/${encodeURIComponent(sessionId)}/routing`,
      {
        agent_id: agentA,
        routing_rules: { channel: 'discord', channel_chat_id: 'chan-A' },
      },
      TEST_SESSION_COOKIE,
    );
    const routeB = await apiCall(
      'POST',
      `/v1/admin/agents/sessions/${encodeURIComponent(sessionIdB)}/routing`,
      {
        agent_id: agentB,
        routing_rules: { channel: 'slack', channel_chat_id: 'chan-B' },
      },
      TEST_SESSION_COOKIE,
    );
    expect(routeA.statusCode).toBe(200);
    expect(routeB.statusCode).toBe(200);

    const list = await apiCall('GET', '/v1/admin/agents/sessions/list', undefined, TEST_SESSION_COOKIE);
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.data?.data)).toBe(true);

    const resolved = await apiCall(
      'POST',
      '/v1/admin/agents/routing/resolve',
      { channel: 'discord', channel_chat_id: 'chan-A' },
      TEST_SESSION_COOKIE,
    );
    expect(resolved.statusCode).toBe(200);
    expect(resolved.data?.data?.agent_id).toBe(agentA);

    const users = await apiCall('GET', '/v1/admin/users', undefined, TEST_SESSION_COOKIE);
    const userId = users.data?.data?.[0]?.id;
    if (userId) {
      const routingRule = await apiCall(
        'POST',
        '/v1/admin/agents/routing-rules',
        {
          agent_id: agentB,
          channel: 'discord',
          channel_chat_id: 'chan-A',
          user_id: userId,
          priority: 200,
          enabled: true,
        },
        TEST_SESSION_COOKIE,
      );
      expect(routingRule.statusCode).toBe(201);

      const resolvedByUser = await apiCall(
        'POST',
        '/v1/admin/agents/routing/resolve',
        { channel: 'discord', channel_chat_id: 'chan-A', user_id: userId },
        TEST_SESSION_COOKIE,
      );
      expect(resolvedByUser.statusCode).toBe(200);
      expect(resolvedByUser.data?.data?.agent_id).toBe(agentB);
    }

    const send = await apiCall(
      'POST',
      '/v1/admin/agents/sessions/send',
      {
        from_agent: agentA,
        to_agent: agentB,
        session_id: sessionId,
        message: 'hello from agent A',
        reply_back: true,
      },
      TEST_SESSION_COOKIE,
    );
    expect(send.statusCode).toBe(201);
    expect(send.data?.data?.status).toMatch(/delivered|responded/);

    const cfgA = await apiCall(
      'PUT',
      `/v1/admin/agents/${encodeURIComponent(agentA)}/config`,
      { settings: { capabilities: ['planner', 'coordinator'] } },
      TEST_SESSION_COOKIE,
    );
    const cfgB = await apiCall(
      'PUT',
      `/v1/admin/agents/${encodeURIComponent(agentB)}/config`,
      { settings: { capabilities: ['calendar', 'email'] } },
      TEST_SESSION_COOKIE,
    );
    expect(cfgA.statusCode).toBe(200);
    expect(cfgB.statusCode).toBe(200);

    const orchestrate = await apiCall(
      'POST',
      '/v1/admin/agents/supervisor/orchestrate',
      {
        supervisor_agent_id: agentA,
        session_id: sessionId,
        task: 'book a meeting and notify stakeholders',
        required_capabilities: ['calendar', 'email'],
        aggregation: 'all',
        conflict_resolution: 'merge',
      },
      TEST_SESSION_COOKIE,
    );
    expect(orchestrate.statusCode).toBe(201);
    expect(orchestrate.data?.data?.supervisor_agent_id).toBe(agentA);
    expect(Array.isArray(orchestrate.data?.data?.assignments)).toBe(true);
    expect(orchestrate.data?.data?.assignments?.length).toBeGreaterThan(0);
    expect(typeof orchestrate.data?.data?.aggregated_result).toBe('string');

    const history = await apiCall('GET', `/v1/admin/agents/sessions/${encodeURIComponent(sessionId)}/history?limit=20`, undefined, TEST_SESSION_COOKIE);
    expect(history.statusCode).toBe(200);
    expect(Array.isArray(history.data?.data)).toBe(true);

    const destroyA = await apiCall('DELETE', `/v1/admin/agents/${encodeURIComponent(agentA)}`, undefined, TEST_SESSION_COOKIE);
    const destroyB = await apiCall('DELETE', `/v1/admin/agents/${encodeURIComponent(agentB)}`, undefined, TEST_SESSION_COOKIE);
    expect(destroyA.statusCode).toBe(200);
    expect(destroyB.statusCode).toBe(200);
  });

  it('integration: subordinate spawn accepts config overrides and enforces nesting depth (optional)', async () => {
    if (!(await isApiReachable())) {
      if (skipOptionalUnlessLive('agents.e2e requires reachable API when RUN_LIVE_GATEWAY_E2E=true')) return;
    }
    if (!TEST_SESSION_COOKIE) {
      if (skipOptionalUnlessLive('agents.e2e requires TEST_SESSION_COOKIE when RUN_LIVE_GATEWAY_E2E=true')) return;
    }

    const parentName = `sub-parent-${Date.now()}`;
    const childName = `sub-child-${Date.now()}`;
    const deepName = `sub-deep-${Date.now()}`;

    const createParent = await apiCall('POST', '/v1/admin/agents', { name: parentName, workspace_path: `/tmp/${parentName}` }, TEST_SESSION_COOKIE);
    const createChild = await apiCall('POST', '/v1/admin/agents', { name: childName, workspace_path: `/tmp/${childName}` }, TEST_SESSION_COOKIE);
    const createDeep = await apiCall('POST', '/v1/admin/agents', { name: deepName, workspace_path: `/tmp/${deepName}` }, TEST_SESSION_COOKIE);
    expect(createParent.statusCode).toBe(201);
    expect(createChild.statusCode).toBe(201);
    expect(createDeep.statusCode).toBe(201);

    const parentId = createParent.data?.data?.id;
    const childId = createChild.data?.data?.id;
    const deepId = createDeep.data?.data?.id;
    expect(typeof parentId).toBe('string');
    expect(typeof childId).toBe('string');
    expect(typeof deepId).toBe('string');

    const setDepth = await apiCall(
      'PUT',
      `/v1/admin/settings/${encodeURIComponent('agent.subordinate.maxNestingDepth')}`,
      { value: 1 },
      TEST_SESSION_COOKIE,
    );
    expect([200, 204]).toContain(setDepth.statusCode);

    try {
      const parentSpawn = await apiCall(
        'POST',
        `/v1/admin/agents/${encodeURIComponent(parentId)}/spawn-session`,
        { session_name: `${parentName}-session` },
        TEST_SESSION_COOKIE,
      );
      expect(parentSpawn.statusCode).toBe(201);
      const sessionId = String(parentSpawn.data?.data?.session_id || '');
      expect(sessionId).toBeTruthy();

      const childSpawn = await apiCall(
        'POST',
        `/v1/admin/agents/${encodeURIComponent(childId)}/spawn-session`,
        {
          session_id: sessionId,
          parent_agent_id: parentId,
          system_prompt: 'Child specialized prompt',
          model_name: 'gpt-4o-mini',
          profile_name: 'performance',
          policy_scope: ['web.fetch', 'nas.read'],
        },
        TEST_SESSION_COOKIE,
      );
      expect(childSpawn.statusCode).toBe(201);
      expect(childSpawn.data?.data?.routing_rules?.parent_agent_id).toBe(parentId);
      expect(childSpawn.data?.data?.routing_rules?.subordinate_overrides?.system_prompt).toBe('Child specialized prompt');
      expect(childSpawn.data?.data?.routing_rules?.subordinate_overrides?.model_name).toBe('gpt-4o-mini');
      expect(childSpawn.data?.data?.routing_rules?.subordinate_overrides?.profile_name).toBe('performance');
      expect(Array.isArray(childSpawn.data?.data?.routing_rules?.policy_scope)).toBe(true);
      expect(childSpawn.data?.data?.nesting_depth).toBe(1);

      const tooDeep = await apiCall(
        'POST',
        `/v1/admin/agents/${encodeURIComponent(deepId)}/spawn-session`,
        {
          session_id: sessionId,
          parent_agent_id: childId,
        },
        TEST_SESSION_COOKIE,
      );
      expect(tooDeep.statusCode).toBe(400);
      expect(String(tooDeep.data?.error?.message || '')).toMatch(/depth/i);
    } finally {
      await apiCall('DELETE', `/v1/admin/agents/${encodeURIComponent(parentId)}`, undefined, TEST_SESSION_COOKIE);
      await apiCall('DELETE', `/v1/admin/agents/${encodeURIComponent(childId)}`, undefined, TEST_SESSION_COOKIE);
      await apiCall('DELETE', `/v1/admin/agents/${encodeURIComponent(deepId)}`, undefined, TEST_SESSION_COOKIE);
      await apiCall(
        'PUT',
        `/v1/admin/settings/${encodeURIComponent('agent.subordinate.maxNestingDepth')}`,
        { value: 5 },
        TEST_SESSION_COOKIE,
      );
    }
  });
});
