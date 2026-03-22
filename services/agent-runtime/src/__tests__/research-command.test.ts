import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handleChatCommand } from '../chat-commands.js';

describe('/research command', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns disabled message when agent.research.enabled is false', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT value FROM settings_global WHERE key = $1 LIMIT 1') && params?.[0] === 'agent.research.enabled') {
          return { rows: [{ value: 'false' }] };
        }
        if (sql.includes('SELECT value FROM settings_global WHERE key = $1 LIMIT 1') && params?.[0] === 'agent.research.maxSteps') {
          return { rows: [{ value: '10' }] };
        }
        return { rows: [] };
      }),
    } as any;

    const emitted: string[] = [];
    const canvasEmitter = {
      emit: jest.fn(async (payload: any) => emitted.push(String(payload.text || ''))),
    } as any;

    const handled = await handleChatCommand({
      pool,
      canvasEmitter,
      event: { chat_id: 'chat-1', channel: 'test', text: '/research ai trends', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Research mode is disabled');
  });

  it('runs quick research pipeline and stores report in memories', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/search?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                title: 'AI update',
                url: 'https://example.com/ai-update',
                content: 'Major update in AI models and deployment.',
              },
            ],
          }),
        } as any;
      }
      if (url.includes('https://example.com/ai-update')) {
        const html = '<html><head><title>AI update</title></head><body>AI systems improved reliability and latency.</body></html>';
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
          arrayBuffer: async () => new TextEncoder().encode(html).buffer,
        } as any;
      }
      return { ok: false, status: 404, statusText: 'Not Found' } as any;
    }) as any;

    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT value FROM settings_global WHERE key = $1 LIMIT 1') && params?.[0] === 'agent.research.enabled') {
          return { rows: [{ value: 'true' }] };
        }
        if (sql.includes('SELECT value FROM settings_global WHERE key = $1 LIMIT 1') && params?.[0] === 'agent.research.maxSteps') {
          return { rows: [{ value: '10' }] };
        }
        if (sql.includes('FROM settings_global') && sql.includes('search.searxng_url')) {
          return { rows: [] };
        }
        if (sql.includes('FROM allowlists')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO memories')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    } as any;

    const emitted: string[] = [];
    const canvasEmitter = {
      emit: jest.fn(async (payload: any) => emitted.push(String(payload.text || ''))),
    } as any;

    const handled = await handleChatCommand({
      pool,
      canvasEmitter,
      event: { chat_id: 'chat-1', channel: 'test', text: '/research quick ai reliability', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted.some((line) => line.includes('Step 1/2: searching'))).toBe(true);
    expect(emitted.some((line) => line.includes('Research report: ai reliability'))).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO memories'),
      expect.arrayContaining([expect.any(String), 'user-1', 'chat-1', expect.stringContaining('research:'), expect.any(String)]),
    );
  });
});
