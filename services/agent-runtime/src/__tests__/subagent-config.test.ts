import { describe, expect, it, jest } from '@jest/globals';
import { isScopeAllowedForSubagent, resolveSubagentConfig } from '../subagent-config';

describe('subagent config resolution', () => {
  it('integration: subordinate inherits parent config and applies explicit overrides', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('FROM agent_sessions')) {
          return {
            rows: [
              {
                routing_rules: {
                  parent_agent_id: 'parent-a',
                  subordinate_overrides: {
                    system_prompt: 'child override prompt',
                    model_name: 'gpt-4o-mini',
                  },
                  policy_scope: ['web.fetch', 'nas.read'],
                },
              },
            ],
          };
        }
        if (sql.includes('FROM agent_configs')) {
          return {
            rows: [
              {
                agent_id: 'parent-a',
                system_prompt: 'parent prompt',
                model_name: 'gpt-4o',
                profile_name: 'balanced',
                settings: { policy_scope: ['web.fetch', 'nas.read', 'nas.write'] },
              },
              {
                agent_id: 'child-a',
                system_prompt: '',
                model_name: '',
                profile_name: '',
                settings: {},
              },
            ],
          };
        }
        return { rows: [] };
      }),
    } as any;

    const cfg = await resolveSubagentConfig(pool, 'chat-1', 'child-a');
    expect(cfg?.system_prompt).toBe('child override prompt');
    expect(cfg?.model_name).toBe('gpt-4o-mini');
    expect(cfg?.profile_name).toBe('balanced');
    expect(cfg?.policy_scope).toEqual(['web.fetch', 'nas.read']);
  });

  it('integration: subagent policy scope matcher supports exact and wildcard scopes', () => {
    expect(isScopeAllowedForSubagent('web.fetch', ['web.fetch'])).toBe(true);
    expect(isScopeAllowedForSubagent('nas.read.file', ['nas.read.*'])).toBe(true);
    expect(isScopeAllowedForSubagent('nas.write', ['nas.read.*', 'web.fetch'])).toBe(false);
    expect(isScopeAllowedForSubagent('web.fetch', [])).toBe(false);
  });

  it('keeps disjoint merged policy scope as explicit deny-all (empty array)', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM agent_sessions')) {
          return {
            rows: [
              {
                routing_rules: {
                  parent_agent_id: 'parent-a',
                  policy_scope: ['ha.write'],
                },
              },
            ],
          };
        }
        if (sql.includes('FROM agent_configs')) {
          return {
            rows: [
              {
                agent_id: 'parent-a',
                system_prompt: '',
                model_name: '',
                profile_name: '',
                settings: { policy_scope: ['web.fetch'] },
              },
              {
                agent_id: 'child-a',
                system_prompt: '',
                model_name: '',
                profile_name: '',
                settings: {},
              },
            ],
          };
        }
        return { rows: [] };
      }),
    } as any;

    const cfg = await resolveSubagentConfig(pool, 'chat-1', 'child-a');
    expect(cfg?.policy_scope).toEqual([]);
    expect(isScopeAllowedForSubagent('web.fetch', cfg?.policy_scope)).toBe(false);
  });

  it('returns explicit resolution_error marker when resolver throws', async () => {
    const pool = {
      query: jest.fn(async () => {
        throw new Error('db unavailable');
      }),
    } as any;

    const cfg = await resolveSubagentConfig(pool, 'chat-1', 'child-a');
    expect(cfg).toEqual(
      expect.objectContaining({
        resolution_error: expect.stringContaining('db unavailable'),
      }),
    );
  });
});
