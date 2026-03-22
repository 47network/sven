import { describe, expect, it, jest } from '@jest/globals';
import { handleChatCommand } from '../chat-commands.js';

describe('/skill command', () => {
  it('lists active skills from tools registry', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('FROM tools') && sql.includes('trust_level')) {
          return {
            rows: [
              { name: 'web_fetch', trust_level: 'trusted' },
              { name: 'device_snapshot', trust_level: 'quarantined' },
            ],
          };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/skill' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Active skills:');
    expect(emitted[0]).toContain('web_fetch (trusted)');
    expect(emitted[0]).toContain('device_snapshot (quarantined)');
  });

  it('returns installed-skills unavailable message when chat has no org binding', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT organization_id FROM chats WHERE id = $1 LIMIT 1')) return { rows: [] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/skill installed' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Installed skills are unavailable');
  });

  it('lists installed skills for chat organization', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT organization_id FROM chats WHERE id = $1 LIMIT 1')) {
          return { rows: [{ organization_id: 'org-1' }] };
        }
        if (sql.includes('FROM skills_installed si') && sql.includes('LEFT JOIN skills_catalog')) {
          return {
            rows: [
              {
                id: 'installed-1',
                name: 'Browser Toolkit',
                tool_id: 'browser_toolkit',
                trust_level: 'trusted',
              },
            ],
          };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/skill installed' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Installed skills:');
    expect(emitted[0]).toContain('Browser Toolkit');
    expect(emitted[0]).toContain('tool=browser_toolkit');
  });

  it('blocks non-admin users from skill install', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT role FROM users WHERE id = $1 LIMIT 1')) return { rows: [{ role: 'user' }] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/skill install browser' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Only admins can install or manage skills.');
  });

  it('blocks skill management during incident lockdown mode', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT role FROM users WHERE id = $1 LIMIT 1')) return { rows: [{ role: 'admin' }] };
        if (sql.includes('SELECT organization_id FROM chats WHERE id = $1 LIMIT 1')) {
          return { rows: [{ organization_id: 'org-1' }] };
        }
        if (sql.includes("SELECT value FROM settings_global WHERE key = 'incident.mode' LIMIT 1")) {
          return { rows: [{ value: '"lockdown"' }] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/skill install browser' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Skill install/manage is blocked while incident controls are active.');
  });
});
