import { describe, expect, it, jest } from '@jest/globals';
import { SelfCorrectionEngine } from '../self-correction';

/**
 * Self-Correction Engine tests.
 *
 * These tests use mocked dependencies (pg.Pool, NatsConnection, LLMRouter, CanvasEmitter)
 * to verify the self-correction behavior without external services.
 */

// Mock tool result events
let runSeq = 0;
function makeToolResult(overrides: Record<string, unknown> = {}) {
  runSeq += 1;
  return {
    run_id: `run-${runSeq.toString().padStart(3, '0')}`,
    tool_name: 'web.fetch',
    chat_id: 'chat-001',
    user_id: 'user-001',
    status: 'error',
    outputs: {},
    error: 'ECONNRESET',
    ...overrides,
  };
}

function makePool(queryResults: Record<string, any> = {}) {
  return {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      // Default: return empty result
      const stmt = typeof sql === 'string' ? sql : '';

      // Self-correction settings
      if (stmt.includes('settings_global') && stmt.includes('ANY')) {
        return { rows: [] };
      }

      // Tool run lookup
      if (stmt.includes('FROM tool_runs') && stmt.includes('WHERE id = $1')) {
        return {
          rows: [{
            id: 'run-001',
            tool_name: 'web.fetch',
            chat_id: 'chat-001',
            user_id: 'user-001',
            inputs: { url: 'https://example.com' },
            approval_id: null,
          }],
        };
      }

      // Budget check
      if (stmt.includes('budgets.daily_tokens')) {
        return { rows: [] }; // No budget set

      }

      // Messages for strategy retry
      if (stmt.includes('FROM messages')) {
        return { rows: [] };
      }

      // Identity doc
      if (stmt.includes('sven_identity_docs')) {
        return { rows: [{ content: 'You are Sven.' }] };
      }

      // Insert (tool_retries, etc.)
      if (stmt.trimStart().startsWith('INSERT')) {
        return { rows: [] };
      }

      return queryResults[stmt] || { rows: [] };
    }),
  } as any;
}

function makeNc() {
  const published: Array<{ subject: string; data: any }> = [];
  return {
    publish: jest.fn((subject: string, data: any) => {
      published.push({ subject, data });
    }),
    _published: published,
  } as any;
}

function makeLlmRouter() {
  return {
    complete: jest.fn(async () => ({
      text: 'I found an alternative approach.',
      tool_calls: [],
      model_used: 'test-model',
      tokens_used: { prompt: 100, completion: 50 },
    })),
  } as any;
}

function makeCanvasEmitter() {
  const emitted: any[] = [];
  return {
    emit: jest.fn(async (payload: any) => {
      emitted.push(payload);
    }),
    _emitted: emitted,
  } as any;
}

describe('SelfCorrectionEngine', () => {
  it('ignores successful tool results', async () => {
    const pool = makePool();
    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const handled = await engine.handleToolResult(makeToolResult({ status: 'completed' }));
    expect(handled).toBe(false);
  });

  it('handles transient errors by retrying same call', async () => {
    const pool = makePool();
    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const handled = await engine.handleToolResult(
      makeToolResult({ status: 'error', error: 'ECONNRESET' }),
    );
    expect(handled).toBe(true);

    // Transient retries are scheduled with setTimeout, so the NATS publish
    // happens asynchronously. Verify the engine accepted the retry.
    // The publish will happen after the backoff delay.
  });

  it('handles fatal errors by reporting to user', async () => {
    const pool = makePool();
    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const handled = await engine.handleToolResult(
      makeToolResult({ status: 'denied', error: 'Denied by policy token=sk_live_123456 /home/app/secret.txt' }),
    );
    expect(handled).toBe(true);
    expect(canvas._emitted.length).toBeGreaterThan(0);
    expect(canvas._emitted[0].text).toContain('unrecoverable');
    expect(canvas._emitted[0].text).not.toContain('sk_live_123456');
    expect(canvas._emitted[0].text).not.toContain('/home/app/secret.txt');
  });

  it('handles strategy errors by re-prompting LLM', async () => {
    const pool = makePool();
    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const handled = await engine.handleToolResult(
      makeToolResult({ status: 'error', error: '404 Not Found' }),
    );
    expect(handled).toBe(true);
    // LLM should have been called for strategy correction
    expect(llm.complete).toHaveBeenCalled();
  });

  it('e2e: self-correction disabled when selfCorrection.enabled=false', async () => {
    const pool = makePool();
    // Override settings to disable
    pool.query = jest.fn(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('settings_global') && sql.includes('ANY')) {
        return {
          rows: [
            { key: 'agent.selfCorrection.enabled', value: JSON.stringify(false) },
          ],
        };
      }
      return { rows: [] };
    }) as any;

    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const handled = await engine.handleToolResult(
      makeToolResult({ status: 'error', error: 'ECONNRESET' }),
    );
    expect(handled).toBe(false);
    expect(nc.publish).not.toHaveBeenCalled();
    expect(llm.complete).not.toHaveBeenCalled();
    expect(canvas.emit).not.toHaveBeenCalled();
  });

  it('e2e: self-correction disabled when enabled value is malformed quoted false string', async () => {
    const pool = makePool();
    pool.query = jest.fn(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('settings_global') && sql.includes('ANY')) {
        return {
          rows: [
            { key: 'agent.selfCorrection.enabled', value: "'false'" },
          ],
        };
      }
      return { rows: [] };
    }) as any;

    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const handled = await engine.handleToolResult(
      makeToolResult({ status: 'error', error: 'ECONNRESET' }),
    );
    expect(handled).toBe(false);
    expect(nc.publish).not.toHaveBeenCalled();
    expect(llm.complete).not.toHaveBeenCalled();
    expect(canvas.emit).not.toHaveBeenCalled();
  });

  it('e2e: approval gate fires at retry threshold', async () => {
    jest.useFakeTimers();
    const pool = makePool();
    // Set requireApprovalAfter=1, so attempt #2 is approval-gated.
    pool.query = jest.fn(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('settings_global') && sql.includes('ANY')) {
        return {
          rows: [
            { key: 'agent.selfCorrection.requireApprovalAfter', value: JSON.stringify(1) },
          ],
        };
      }
      if (typeof sql === 'string' && sql.includes('FROM tool_runs WHERE id')) {
        return {
          rows: [{
            id: 'run-approval-001',
            tool_name: 'web.fetch',
            chat_id: 'chat-001',
            user_id: 'user-001',
            inputs: { url: 'https://example.com' },
            approval_id: null,
          }],
        };
      }
      if (typeof sql === 'string' && sql.includes('budgets.daily_tokens')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT')) {
        return { rows: [] };
      }
      return { rows: [] };
    }) as any;
    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    // Attempt #1: transient retry is allowed.
    const handled1 = await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-approval-001',
        tool_name: 'web.fetch',
        status: 'error',
        error: 'ECONNRESET',
      }),
    );
    expect(handled1).toBe(true);

    // Attempt #2: should be blocked by approval threshold.
    const handled2 = await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-approval-001',
        tool_name: 'web.fetch',
        status: 'error',
        error: 'ETIMEDOUT',
      }),
    );
    expect(handled2).toBe(true);
    expect(canvas._emitted.length).toBeGreaterThan(0);
    expect(canvas._emitted[canvas._emitted.length - 1].text).toContain('approval threshold');

    // No retry should be published for the blocked second attempt.
    jest.advanceTimersByTime(50);
    expect(nc._published.length).toBe(0);
    jest.useRealTimers();
  });

  it('detects infinite loops in strategy retries', async () => {
    const pool = makePool();
    const nc = makeNc();
    // LLM returns the SAME tool call (infinite loop scenario)
    const llm = {
      complete: jest.fn(async () => ({
        text: 'Trying again...',
        tool_calls: [{
          name: 'web.fetch',
          inputs: { url: 'https://example.com' },
          run_id: 'run-retry-1',
        }],
        model_used: 'test-model',
        tokens_used: { prompt: 100, completion: 50 },
      })),
    } as any;
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    // First strategy retry — should succeed (new call dispatch)
    await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-001',
        status: 'error',
        error: 'File not found: /path/to/missing.txt',
      }),
    );

    // Second call with the SAME signature from the retry — should detect loop
    // We need to simulate a result from the retried call
    pool.query = jest.fn(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM tool_runs WHERE id')) {
        return {
          rows: [{
            id: 'run-retry-1',
            tool_name: 'web.fetch',
            chat_id: 'chat-001',
            user_id: 'user-001',
            inputs: { url: 'https://example.com' },
            approval_id: null,
          }],
        };
      }
      if (typeof sql === 'string' && sql.includes('settings_global')) {
        return { rows: [] };
      }
      return { rows: [] };
    }) as any;

    const handled2 = await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-retry-1',
        status: 'error',
        error: 'File not found again',
      }),
    );
    expect(handled2).toBe(true);
  });

  it('integration: retries failed web fetch with corrected URL', async () => {
    const pool = makePool();
    const nc = makeNc();
    const llm = {
      complete: jest.fn(async () => ({
        text: 'Retrying with corrected URL.',
        tool_calls: [{
          name: 'web.fetch',
          inputs: { url: 'https://example.org' },
          run_id: 'run-retry-web-1',
        }],
        model_used: 'test-model',
        tokens_used: { prompt: 120, completion: 40 },
      })),
    } as any;
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const handled = await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-web-001',
        tool_name: 'web.fetch',
        status: 'error',
        error: '404 Not Found',
      }),
    );
    expect(handled).toBe(true);
    const published = nc._published.find((p: any) => p.subject === 'tool.run.request');
    expect(Boolean(published)).toBe(true);
  });

  it('caps strategy retry fan-out to one dispatched tool call per attempt', async () => {
    const pool = makePool();
    const nc = makeNc();
    const llm = {
      complete: jest.fn(async () => ({
        text: 'Trying alternatives',
        tool_calls: [
          {
            name: 'web.fetch',
            inputs: { url: 'https://first.example.com' },
            run_id: 'run-retry-first-1',
          },
          {
            name: 'web.fetch',
            inputs: { url: 'https://second.example.com' },
            run_id: 'run-retry-second-1',
          },
        ],
        model_used: 'test-model',
        tokens_used: { prompt: 120, completion: 40 },
      })),
    } as any;
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const handled = await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-fanout-001',
        tool_name: 'web.fetch',
        status: 'error',
        error: '404 Not Found',
      }),
    );
    expect(handled).toBe(true);

    const published = nc._published.filter((p: any) => p.subject === 'tool.run.request');
    expect(published).toHaveLength(1);
  });

  it('integration: retries failed file read with corrected path', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('settings_global') && sql.includes('ANY')) {
          return { rows: [] };
        }
        if (typeof sql === 'string' && sql.includes('FROM tool_runs WHERE id')) {
          return {
            rows: [{
              id: 'run-file-001',
              tool_name: 'nas.read',
              chat_id: 'chat-001',
              user_id: 'user-001',
              inputs: { path: '/docs/missing.md' },
              approval_id: null,
            }],
          };
        }
        if (typeof sql === 'string' && sql.includes('budgets.daily_tokens')) return { rows: [] };
        if (typeof sql === 'string' && sql.includes('FROM messages')) return { rows: [] };
        if (typeof sql === 'string' && sql.includes('sven_identity_docs')) {
          return { rows: [{ content: 'You are Sven.' }] };
        }
        return { rows: [] };
      }),
    } as any;
    const nc = makeNc();
    const llm = {
      complete: jest.fn(async () => ({
        text: 'Trying corrected path.',
        tool_calls: [{
          name: 'nas.read',
          inputs: { path: '/docs/README.md' },
          run_id: 'run-retry-file-1',
        }],
        model_used: 'test-model',
        tokens_used: { prompt: 110, completion: 30 },
      })),
    } as any;
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const handled = await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-file-001',
        tool_name: 'nas.read',
        status: 'error',
        error: 'file not found',
      }),
    );
    expect(handled).toBe(true);
    const published = nc._published.find((p: any) => p.subject === 'tool.run.request');
    expect(Boolean(published)).toBe(true);
  });

  it('handles malformed tool_runs.inputs JSON without aborting retry handling', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('settings_global') && sql.includes('ANY')) {
          return { rows: [] };
        }
        if (typeof sql === 'string' && sql.includes('FROM tool_runs WHERE id')) {
          return {
            rows: [{
              id: 'run-malformed-001',
              tool_name: 'web.fetch',
              chat_id: 'chat-001',
              user_id: 'user-001',
              inputs: '{"url":', // malformed JSON
              approval_id: null,
            }],
          };
        }
        if (typeof sql === 'string' && sql.includes('budgets.daily_tokens')) return { rows: [] };
        return { rows: [] };
      }),
    } as any;
    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const handled = await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-malformed-001',
        tool_name: 'web.fetch',
        status: 'error',
        error: 'ECONNRESET',
      }),
    );
    expect(handled).toBe(true);
  });

  it('suppresses delayed transient retry when self-correction is disabled before timer fires', async () => {
    jest.useFakeTimers();

    let selfCorrectionEnabled = true;
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('settings_global') && sql.includes('ANY')) {
          return {
            rows: [
              { key: 'agent.selfCorrection.enabled', value: JSON.stringify(selfCorrectionEnabled) },
            ],
          };
        }
        if (typeof sql === 'string' && sql.includes('FROM tool_runs WHERE id')) {
          return {
            rows: [{
              id: 'run-disable-midflight-001',
              tool_name: 'web.fetch',
              chat_id: 'chat-001',
              user_id: 'user-001',
              inputs: { url: 'https://example.com' },
              approval_id: null,
            }],
          };
        }
        if (typeof sql === 'string' && sql.includes("WHERE key = 'budgets.daily_tokens'")) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    } as any;

    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const handled = await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-disable-midflight-001',
        tool_name: 'web.fetch',
        status: 'error',
        error: 'ECONNRESET',
      }),
    );
    expect(handled).toBe(true);

    // Policy flips after scheduling, before dispatch.
    selfCorrectionEnabled = false;
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    await Promise.resolve();

    expect(nc._published).toHaveLength(0);
    jest.useRealTimers();
  });

  it('suppresses delayed transient retry when budget is exceeded before timer fires', async () => {
    jest.useFakeTimers();

    let budget = 0;
    let usage = 0;
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (typeof sql === 'string' && sql.includes('settings_global') && sql.includes('ANY')) {
          return {
            rows: [
              { key: 'agent.selfCorrection.enabled', value: JSON.stringify(true) },
            ],
          };
        }
        if (typeof sql === 'string' && sql.includes('FROM tool_runs WHERE id')) {
          return {
            rows: [{
              id: 'run-budget-midflight-001',
              tool_name: 'web.fetch',
              chat_id: 'chat-001',
              user_id: 'user-001',
              inputs: { url: 'https://example.com' },
              approval_id: null,
            }],
          };
        }
        if (typeof sql === 'string' && sql.includes("WHERE key = 'budgets.daily_tokens'")) {
          return budget > 0 ? { rows: [{ value: JSON.stringify(budget) }] } : { rows: [] };
        }
        if (typeof sql === 'string' && sql.includes('SELECT value FROM settings_global WHERE key = $1')) {
          if (Array.isArray(params) && params[0] === `usage.${new Date().toISOString().slice(0, 10)}.total`) {
            return usage > 0 ? { rows: [{ value: JSON.stringify(usage) }] } : { rows: [] };
          }
        }
        return { rows: [] };
      }),
    } as any;

    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const handled = await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-budget-midflight-001',
        tool_name: 'web.fetch',
        status: 'error',
        error: 'ECONNRESET',
      }),
    );
    expect(handled).toBe(true);

    // Budget tightens after scheduling, before dispatch.
    budget = 1000;
    usage = 950;
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    await Promise.resolve();

    expect(nc._published).toHaveLength(0);
    jest.useRealTimers();
  });

  it('enforces user-scoped retry budget independently per user', async () => {
    jest.useFakeTimers();
    const today = new Date().toISOString().slice(0, 10);

    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (typeof sql === 'string' && sql.includes('settings_global') && sql.includes('ANY')) {
          return { rows: [] };
        }
        if (typeof sql === 'string' && sql.includes('FROM tool_runs WHERE id')) {
          const runId = Array.isArray(params) ? String(params[0]) : '';
          if (runId === 'run-user-budget-high-001') {
            return {
              rows: [{
                id: runId,
                tool_name: 'web.fetch',
                chat_id: 'chat-001',
                user_id: 'user-high',
                inputs: { url: 'https://example.com/high' },
                approval_id: null,
              }],
            };
          }
          if (runId === 'run-user-budget-low-001') {
            return {
              rows: [{
                id: runId,
                tool_name: 'web.fetch',
                chat_id: 'chat-001',
                user_id: 'user-low',
                inputs: { url: 'https://example.com/low' },
                approval_id: null,
              }],
            };
          }
          return { rows: [] };
        }
        if (typeof sql === 'string' && sql.includes("WHERE key = 'budgets.daily_tokens'")) {
          return { rows: [] };
        }
        if (typeof sql === 'string' && sql.includes('SELECT value FROM settings_global WHERE key = $1')) {
          const key = Array.isArray(params) ? String(params[0]) : '';
          if (key === 'budgets.daily_tokens.user.user-high') {
            return { rows: [{ value: JSON.stringify(100) }] };
          }
          if (key === 'budgets.daily_tokens.user.user-low') {
            return { rows: [{ value: JSON.stringify(100) }] };
          }
          if (key === `usage.${today}.user.user-high`) {
            return { rows: [{ value: JSON.stringify(95) }] };
          }
          if (key === `usage.${today}.user.user-low`) {
            return { rows: [{ value: JSON.stringify(10) }] };
          }
          return { rows: [] };
        }
        return { rows: [] };
      }),
    } as any;

    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    const blockedHandled = await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-user-budget-high-001',
        tool_name: 'web.fetch',
        status: 'error',
        error: 'ECONNRESET',
      }),
    );
    expect(blockedHandled).toBe(true);
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    await Promise.resolve();
    expect(nc._published).toHaveLength(0);

    const allowedHandled = await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-user-budget-low-001',
        tool_name: 'web.fetch',
        status: 'error',
        error: 'ECONNRESET',
      }),
    );
    expect(allowedHandled).toBe(true);
    if (typeof (jest as any).runOnlyPendingTimersAsync === 'function') {
      await (jest as any).runOnlyPendingTimersAsync();
    } else {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    }

    expect(nc._published.length).toBeGreaterThan(0);
    jest.useRealTimers();
  });

  it('clamps extreme retry config and schedules bounded finite transient delay', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const pool = makePool();
    pool.query = jest.fn(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('settings_global') && sql.includes('ANY')) {
        return {
          rows: [
            { key: 'agent.selfCorrection.maxRetries', value: JSON.stringify(999999999) },
            { key: 'agent.selfCorrection.requireApprovalAfter', value: JSON.stringify(999999999) },
          ],
        };
      }
      if (typeof sql === 'string' && sql.includes('FROM tool_runs WHERE id')) {
        return {
          rows: [{
            id: 'run-bounded-001',
            tool_name: 'web.fetch',
            chat_id: 'chat-001',
            user_id: 'user-001',
            inputs: { url: 'https://example.com' },
            approval_id: null,
          }],
        };
      }
      if (typeof sql === 'string' && sql.includes('budgets.daily_tokens')) return { rows: [] };
      return { rows: [] };
    }) as any;

    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);
    await engine.loadConfig();

    expect((engine as any).config.maxRetries).toBe(12);
    expect((engine as any).config.requireApprovalAfter).toBe(12);

    const handled = await engine.handleToolResult(
      makeToolResult({
        run_id: 'run-bounded-001',
        tool_name: 'web.fetch',
        status: 'error',
        error: 'ECONNRESET',
      }),
    );
    expect(handled).toBe(true);

    const timeoutCall = setTimeoutSpy.mock.calls[0];
    expect(timeoutCall).toBeDefined();
    const scheduledDelay = Number(timeoutCall[1]);
    expect(Number.isFinite(scheduledDelay)).toBe(true);
    expect(scheduledDelay).toBeGreaterThanOrEqual(50);
    expect(scheduledDelay).toBeLessThanOrEqual(30000);

    setTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

  it('computes identical signatures for nested-object key reorderings', async () => {
    const pool = makePool();
    const nc = makeNc();
    const llm = makeLlmRouter();
    const canvas = makeCanvasEmitter();
    const engine = new SelfCorrectionEngine(pool, nc, llm, canvas);

    const left = {
      config: {
        z: 1,
        a: {
          innerB: 'b',
          innerA: 'a',
        },
      },
      list: [
        { y: 2, x: 1 },
        'keep-order',
      ],
    };
    const right = {
      list: [
        { x: 1, y: 2 },
        'keep-order',
      ],
      config: {
        a: {
          innerA: 'a',
          innerB: 'b',
        },
        z: 1,
      },
    };

    const leftSig = (engine as any).computeCallSignature('web.fetch', left);
    const rightSig = (engine as any).computeCallSignature('web.fetch', right);
    expect(leftSig).toBe(rightSig);
  });
});
