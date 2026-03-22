import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { encryptLiteLlmVirtualKey } from '@sven/shared';
import { LLMRouter } from '../llm-router.js';

type QueryResult = { rows: any[] };

class MockPool {
  public queries: Array<{ sql: string; params?: unknown[] }> = [];
  private readonly encryptedVirtualKey: string;
  constructor(private opts: { usageTotal?: number } = {}) {
    this.encryptedVirtualKey = encryptLiteLlmVirtualKey('sk-virtual-abc');
  }

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
      return { rows: [{ value: 'true' }] };
    }
    if (
      sql.includes('FROM settings_global')
      && sql.includes('llm.litellm.url')
      && sql.includes('llm.litellm.api_key')
      && sql.includes('llm.litellm.use_virtual_keys')
    ) {
      return {
        rows: [
          { key: 'llm.litellm.url', value: '"http://litellm:4000"' },
          { key: 'llm.litellm.api_key', value: '"sk-master"' },
          { key: 'llm.litellm.use_virtual_keys', value: 'true' },
        ],
      };
    }
    if (sql.includes('FROM model_registry') && sql.includes('WHERE name = $1 OR model_id = $1')) {
      return {
        rows: [
          {
            id: 'model-1',
            name: 'gpt-4o',
            endpoint: 'http://openai:4000',
            provider: 'openai',
            is_local: false,
            cost_per_1k_tokens: 0.002,
          },
        ],
      };
    }
    if (sql.includes('FROM model_registry') && sql.includes('WHERE is_local =')) {
      return { rows: [] };
    }
    if (sql.includes('SELECT active_organization_id FROM users')) {
      return { rows: [{ active_organization_id: 'org-1' }] };
    }
    if (sql.includes('FROM litellm_virtual_keys')) {
      return { rows: [{ id: 'key-1', virtual_key: this.encryptedVirtualKey, max_daily_budget_usd: 5 }] };
    }
    if (sql.includes('FROM model_usage_logs') && sql.includes('SUM(total_cost)')) {
      return { rows: [{ total: this.opts.usageTotal ?? 0 }] };
    }
    if (sql.includes('INSERT INTO model_usage_logs')) {
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO settings_global') || sql.includes('UPDATE litellm_virtual_keys')) {
      return { rows: [] };
    }
    if (sql.includes("settings_global WHERE key = 'budgets.daily_tokens'")) {
      return { rows: [] };
    }
    if (sql.includes('usage.') && sql.includes('settings_global')) {
      return { rows: [] };
    }

    return { rows: [] };
  }
}

describe('LLMRouter LiteLLM integration', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.SVEN_LITELLM_VIRTUAL_KEY_ENCRYPTION_KEY = 'litellm-test-encryption-key';
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'pong' } }],
        usage: { prompt_tokens: 5, completion_tokens: 7 },
      }),
    }));
  });

  it('routes requests through LiteLLM and uses virtual key', async () => {
    const pool = new MockPool();
    const router = new LLMRouter(pool as any);

    const res = await router.complete({
      messages: [{ role: 'user', text: 'ping', content_type: 'text' }],
      systemPrompt: 'system',
      user_id: 'user-1',
      chat_id: 'chat-1',
      agent_id: 'agent-1',
      model_override: 'gpt-4o',
    });

    expect(res.text).toBe('pong');
    expect((global as any).fetch).toHaveBeenCalled();
    const [url, init] = (global as any).fetch.mock.calls[0];
    expect(String(url)).toBe('http://litellm:4000/v1/chat/completions');
    expect(init?.headers?.Authorization).toBe('Bearer sk-virtual-abc');

    const insert = pool.queries.find((q) => q.sql.includes('INSERT INTO model_usage_logs'));
    expect(insert).toBeDefined();
    expect(insert?.params?.[5]).toBe('agent-1');
  });

  it('blocks when virtual key budget is exceeded', async () => {
    const pool = new MockPool({ usageTotal: 10 });
    const router = new LLMRouter(pool as any);

    const res = await router.complete({
      messages: [{ role: 'user', text: 'ping', content_type: 'text' }],
      systemPrompt: 'system',
      user_id: 'user-1',
      chat_id: 'chat-1',
      agent_id: 'agent-1',
      model_override: 'gpt-4o',
    });

    expect(res.model_used).toBe('budget_guard');
    expect(res.text.toLowerCase()).toContain('budget');
    expect((global as any).fetch).not.toHaveBeenCalled();
  });
});
