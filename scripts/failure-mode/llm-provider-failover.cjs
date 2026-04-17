#!/usr/bin/env node
/* eslint-disable no-console */

async function main() {
  const { LLMRouter } = await import('../../services/agent-runtime/dist/llm-router.js');

  class MockPool {
    async query(sql, params) {
      if (sql.includes("settings_global WHERE key = 'performance.pause_jobs'")) {
        return { rows: [{ value: 'false' }] };
      }
      if (sql.includes("settings_global WHERE key = 'performance.max_llm_concurrency'")) {
        return { rows: [{ value: '4' }] };
      }
      if (sql.includes("settings_global WHERE key = 'performance.gaming_mode'")) {
        return { rows: [{ value: 'false' }] };
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
        return { rows: [] };
      }
      if (sql.includes('FROM model_policies')) {
        return { rows: [] };
      }
      if (sql.includes('FROM model_registry') && sql.includes('WHERE is_local = TRUE')) {
        return {
          rows: [{
            id: 'local-1',
            name: 'local-primary',
            endpoint: 'http://llm-local:11434',
            provider: 'ollama',
            is_local: true,
            cost_per_1k_tokens: null,
          }],
        };
      }
      if (sql.includes('FROM model_registry') && sql.includes('WHERE is_local = FALSE')) {
        return {
          rows: [{
            id: 'cloud-1',
            name: 'cloud-fallback',
            endpoint: 'http://llm-cloud:4000',
            provider: 'openai',
            is_local: false,
            cost_per_1k_tokens: 0.002,
          }],
        };
      }
      // Router was refactored to query by capabilities: 'chat' = ANY(capabilities).
      // Return a local-primary candidate first (which the stubbed fetch marks 503)
      // followed by cloud-fallback so the router observes failover to the cloud
      // provider. The router orders by `is_local DESC` for the balanced profile,
      // but candidates are consumed in row order for the failover loop after
      // candidate selection, so we return local first then cloud.
      if (
        sql.includes('FROM model_registry') &&
        sql.includes("'chat' = ANY(capabilities)") &&
        sql.includes('is_active = TRUE')
      ) {
        return {
          rows: [
            {
              id: 'local-1',
              name: 'local-primary',
              endpoint: 'http://llm-local:11434',
              provider: 'ollama',
              is_local: true,
              cost_per_1k_tokens: null,
            },
            {
              id: 'cloud-1',
              name: 'cloud-fallback',
              endpoint: 'http://llm-cloud:4000',
              provider: 'openai',
              is_local: false,
              cost_per_1k_tokens: 0.002,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO settings_global')) return { rows: [] };
      if (sql.includes('SELECT active_organization_id FROM users')) {
        return { rows: [{ active_organization_id: 'org-1' }] };
      }
      if (sql.includes('INSERT INTO model_usage_logs')) return { rows: [] };
      return { rows: [] };
    }
  }

  let localAttempts = 0;
  let cloudAttempts = 0;

  global.fetch = async (url) => {
    const target = String(url || '');
    if (target.includes('/api/chat') && !target.includes('llm-cloud')) {
      localAttempts += 1;
      return {
        ok: false,
        status: 503,
        text: async () => 'local provider unavailable',
      };
    }
    if (target.includes('llm-cloud') && target.includes('/v1/chat/completions')) {
      cloudAttempts += 1;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'fallback-response-ok' } }],
          usage: { prompt_tokens: 3, completion_tokens: 7 },
        }),
        headers: { get: () => null },
      };
    }
    throw new Error(`Unexpected fetch target: ${target}`);
  };

  const router = new LLMRouter(new MockPool());
  const response = await router.complete({
    messages: [{ role: 'user', text: 'hello', content_type: 'text' }],
    systemPrompt: 'system',
    user_id: 'user-1',
    chat_id: 'chat-1',
  });

  if (response.text !== 'fallback-response-ok') {
    throw new Error(`Unexpected response text: ${response.text}`);
  }
  if (localAttempts < 1 || cloudAttempts < 1) {
    throw new Error(`Failover not observed (local=${localAttempts}, cloud=${cloudAttempts})`);
  }

  console.log(`llm-provider-failover: pass (local_attempts=${localAttempts}, cloud_attempts=${cloudAttempts})`);
}

main().catch((err) => {
  console.error('llm-provider-failover failed:', err);
  process.exit(1);
});
