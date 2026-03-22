import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LLMRouter } from '../llm-router';

type QueryResult = { rows: any[] };

class MockPool {
  public queries: Array<{ sql: string; params?: unknown[] }> = [];
  public subscriptionTokenRef: string | null = null;

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.queries.push({ sql, params });

    if (sql.includes("settings_global WHERE key = 'performance.pause_jobs'")) {
      return { rows: [{ value: 'false' }] };
    }
    if (sql.includes("settings_global WHERE key = 'performance.max_llm_concurrency'")) {
      return { rows: [{ value: '4' }] };
    }
    if (sql.includes("settings_global WHERE key = 'performance.profile'")) {
      return { rows: [{ value: '"balanced"' }] };
    }
    if (sql.includes("settings_global WHERE key = 'llm.litellm.enabled'")) {
      return { rows: [{ value: 'false' }] };
    }
    if (sql.includes("settings_global WHERE key = 'budgets.daily_tokens'")) {
      return { rows: [] };
    }
    if (sql.includes('usage.') && sql.includes('settings_global')) {
      return { rows: [] };
    }
    if (sql.includes('SELECT value FROM settings_global WHERE key = $1 LIMIT 1')) {
      const key = String(params?.[0] || '');
      if (key === 'llm.providerKeys.openai') {
        return { rows: [{ value: JSON.stringify(['sk-openai-a', 'sk-openai-b']) }] };
      }
      if (key === 'llm.providerKeyRotation.openai') {
        return { rows: [{ value: '"round_robin"' }] };
      }
      return { rows: [] };
    }
    if (sql.includes('SELECT key, value') && sql.includes('WHERE key IN ($1, $2)')) {
      const primary = String(params?.[0] || '');
      if (primary === 'llm.providerSubscriptionAuth.openai.token_ref' && this.subscriptionTokenRef) {
        return {
          rows: [
            {
              key: 'llm.providerSubscriptionAuth.openai.token_ref',
              value: JSON.stringify(this.subscriptionTokenRef),
            },
          ],
        };
      }
      return { rows: [] };
    }
    if (sql.includes('FROM model_registry') && sql.includes('WHERE name = $1 OR model_id = $1')) {
      return {
        rows: [{
          id: 'model-1',
          name: 'gpt-4o',
          endpoint: 'http://openai:4000',
          provider: 'openai',
          is_local: false,
          cost_per_1k_tokens: 0.002,
        }],
      };
    }
    if (sql.includes('SELECT active_organization_id FROM users')) {
      return { rows: [{ active_organization_id: 'org-1' }] };
    }
    if (sql.includes('INSERT INTO model_usage_logs')) {
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO settings_global')) {
      return { rows: [] };
    }

    return { rows: [] };
  }
}

describe('LLMRouter provider key pools', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.COPILOT_TOKEN;
    delete process.env.BAD_PROVIDER_REF;
  });

  it('distributes requests across multiple provider keys (round_robin)', async () => {
    const pool = new MockPool();
    const router = new LLMRouter(pool as any);
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      }),
      headers: { get: () => null },
    }));

    await router.complete({
      messages: [{ role: 'user', text: 'one', content_type: 'text' }],
      systemPrompt: 'system',
      user_id: 'user-1',
      chat_id: 'chat-1',
      model_override: 'gpt-4o',
    });
    await router.complete({
      messages: [{ role: 'user', text: 'two', content_type: 'text' }],
      systemPrompt: 'system',
      user_id: 'user-1',
      chat_id: 'chat-1',
      model_override: 'gpt-4o',
    });

    const authHeaders = (global as any).fetch.mock.calls.map((call: any[]) => call[1]?.headers?.Authorization);
    expect(authHeaders[0]).toBe('Bearer sk-openai-a');
    expect(authHeaders[1]).toBe('Bearer sk-openai-b');
  });

  it('prepends resolved provider subscription auth token into key rotation', async () => {
    const pool = new MockPool();
    pool.subscriptionTokenRef = 'env://COPILOT_TOKEN';
    process.env.COPILOT_TOKEN = 'sub-oauth-token';
    const router = new LLMRouter(pool as any);
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      }),
      headers: { get: () => null },
    }));

    await router.complete({
      messages: [{ role: 'user', text: 'one', content_type: 'text' }],
      systemPrompt: 'system',
      user_id: 'user-1',
      chat_id: 'chat-1',
      model_override: 'gpt-4o',
    });
    await router.complete({
      messages: [{ role: 'user', text: 'two', content_type: 'text' }],
      systemPrompt: 'system',
      user_id: 'user-1',
      chat_id: 'chat-1',
      model_override: 'gpt-4o',
    });

    const authHeaders = (global as any).fetch.mock.calls.map((call: any[]) => call[1]?.headers?.Authorization);
    expect(authHeaders[0]).toBe('Bearer sub-oauth-token');
    expect(authHeaders[1]).toBe('Bearer sk-openai-a');
  });

  it('falls back to provider keys when subscription token ref resolution fails', async () => {
    const pool = new MockPool();
    pool.subscriptionTokenRef = 'env://BAD_PROVIDER_REF';
    const router = new LLMRouter(pool as any);
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      }),
      headers: { get: () => null },
    }));

    await router.complete({
      messages: [{ role: 'user', text: 'fallback', content_type: 'text' }],
      systemPrompt: 'system',
      user_id: 'user-1',
      chat_id: 'chat-1',
      model_override: 'gpt-4o',
    });

    const authHeader = (global as any).fetch.mock.calls[0]?.[1]?.headers?.Authorization;
    expect(authHeader).toBe('Bearer sk-openai-a');
  });

  it('rotates to next key when current key is rate-limited', async () => {
    const pool = new MockPool();
    const router = new LLMRouter(pool as any);
    let call = 0;
    (global as any).fetch = jest.fn(async () => {
      call += 1;
      if (call === 1) {
        return {
          ok: false,
          status: 429,
          text: async () => 'rate limited',
          headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? '1' : null) },
        };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'pong' } }],
          usage: { prompt_tokens: 2, completion_tokens: 5 },
        }),
        headers: { get: () => null },
      };
    });

    const res = await router.complete({
      messages: [{ role: 'user', text: 'retry', content_type: 'text' }],
      systemPrompt: 'system',
      user_id: 'user-1',
      chat_id: 'chat-1',
      model_override: 'gpt-4o',
    });

    expect(res.text).toBe('pong');
    const authHeaders = (global as any).fetch.mock.calls.map((c: any[]) => c[1]?.headers?.Authorization);
    expect(authHeaders[0]).toBe('Bearer sk-openai-a');
    expect(authHeaders[1]).toBe('Bearer sk-openai-b');
  });
});
