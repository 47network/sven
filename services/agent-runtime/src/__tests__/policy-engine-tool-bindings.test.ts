import { describe, expect, it, jest } from '@jest/globals';
import { PolicyEngine } from '../policy-engine.js';

type ToolBindingConfig = {
  providers?: Record<string, { allow?: string[]; deny?: string[] }>;
  models?: Record<string, { allow?: string[]; deny?: string[] }>;
};

function makePool(config?: ToolBindingConfig) {
  return {
    query: jest.fn(async (sql: string) => {
      if (sql.includes("FROM settings_global WHERE key = 'incident.mode'")) {
        return { rows: [] };
      }
      if (sql.includes('SELECT organization_id FROM chats')) {
        return { rows: [{ organization_id: 'org-1' }] };
      }
      if (sql.includes('FROM permissions')) {
        return {
          rows: [
            {
              id: 'perm-allow-runtime-read',
              scope: 'runtime.read',
              effect: 'allow',
              target_type: 'global',
              target_id: null,
              conditions: null,
            },
          ],
        };
      }
      if (sql.includes('SELECT permissions_required FROM tools')) {
        return {
          rows: [{ permissions_required: ['runtime.read'] }],
        };
      }
      if (
        sql.includes('FROM organization_settings')
        && sql.includes("key = 'tool_policy.by_provider'")
      ) {
        if (!config) return { rows: [] };
        return { rows: [{ value: JSON.stringify(config) }] };
      }
      if (
        sql.includes("FROM settings_global WHERE key = 'tool_policy.by_provider'")
      ) {
        return { rows: [] };
      }
      return { rows: [] };
    }),
  } as any;
}

async function evaluateWithConfig(
  config: ToolBindingConfig | undefined,
  toolName: string,
  providerName = 'openai',
  modelName = 'gpt-4o',
) {
  const engine = new PolicyEngine(makePool(config));
  return engine.evaluateToolCall({
    tool_name: toolName,
    user_id: 'user-1',
    chat_id: 'chat-1',
    inputs: {},
    provider_name: providerName,
    model_name: modelName,
  });
}

describe('PolicyEngine tool_policy.by_provider bindings', () => {
  it('allows tool call when no provider/model bindings are configured', async () => {
    const decision = await evaluateWithConfig(undefined, 'web.fetch');
    expect(decision.allowed).toBe(true);
  });

  it('denies tool when provider deny rule matches', async () => {
    const decision = await evaluateWithConfig(
      {
        providers: {
          openai: { deny: ['web.*'] },
        },
      },
      'web.fetch',
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('denied by tool binding rules');
  });

  it('enforces provider allowlist when allow rules are present', async () => {
    const decision = await evaluateWithConfig(
      {
        providers: {
          openai: { allow: ['search.*'] },
        },
      },
      'web.fetch',
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('not allowlisted');
  });

  it('supports model wildcard bindings against provider/model id', async () => {
    const allowedDecision = await evaluateWithConfig(
      {
        models: {
          'openai/gpt-*': { allow: ['search.web'] },
        },
      },
      'search.web',
      'openai',
      'gpt-4o-mini',
    );
    expect(allowedDecision.allowed).toBe(true);

    const deniedDecision = await evaluateWithConfig(
      {
        models: {
          'openai/gpt-*': { allow: ['search.web'] },
        },
      },
      'web.fetch',
      'openai',
      'gpt-4o-mini',
    );
    expect(deniedDecision.allowed).toBe(false);
    expect(deniedDecision.reason).toContain('not allowlisted');
  });

  it('applies deny precedence across matched provider and model rules', async () => {
    const decision = await evaluateWithConfig(
      {
        providers: {
          openai: { allow: ['web.*'] },
        },
        models: {
          'openai/gpt-4o': { deny: ['web.fetch'] },
        },
      },
      'web.fetch',
      'openai',
      'gpt-4o',
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('denied by tool binding rules');
  });

  it('allows when any active allow rule matches and no deny applies', async () => {
    const decision = await evaluateWithConfig(
      {
        providers: {
          openai: { allow: ['search.*'] },
        },
        models: {
          'openai/gpt-4o': { allow: ['web.fetch'] },
        },
      },
      'web.fetch',
      'openai',
      'gpt-4o',
    );
    expect(decision.allowed).toBe(true);
  });
});

