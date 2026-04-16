import { describe, expect, it, jest } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { handleChatCommand } from '../chat-commands.js';

describe('ops commands', () => {
  it('/queue returns status even when metrics tables are unavailable', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        throw Object.assign(new Error('missing table'), { code: '42P01' });
      }),
    } as any;

    const emitted: string[] = [];
    const canvasEmitter = {
      emit: jest.fn(async (payload: any) => emitted.push(String(payload.text || ''))),
    } as any;

    const handled = await handleChatCommand({
      pool,
      canvasEmitter,
      event: { chat_id: 'chat-1', channel: 'test', text: '/queue', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Queue status:');
  });

  it('/config set verbose true persists session setting', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('INSERT INTO session_settings')) return { rows: [] };
        if (sql.includes('UPDATE session_settings')) return { rows: [] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/config set verbose true', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('verbose set to true');
  });

  it('/tell queues inter-agent message when mapping exists', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT role FROM users WHERE id = $1')) return { rows: [{ role: 'admin' }] };
        if (sql.includes('FROM agent_sessions')) return { rows: [{ agent_id: 'agent-a' }, { agent_id: 'agent-b' }] };
        if (sql.includes('INSERT INTO inter_agent_messages')) return { rows: [] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/tell agent-b hello', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Message queued to agent-b');
  });

  it('/tell rejects non-admin users and does not queue inter-agent message', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT role FROM users WHERE id = $1')) return { rows: [{ role: 'user' }] };
        if (sql.includes('INSERT INTO inter_agent_messages')) return { rows: [] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/tell agent-b hello', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Only admins can message subagents.');
    const insertCalls = (pool.query as jest.Mock).mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO inter_agent_messages'));
    expect(insertCalls).toHaveLength(0);
  });

  it('/prose list returns workflow entries for current chat', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('FROM workflows')) {
          return {
            rows: [
              { id: 'wf_1', name: 'Daily Ops', version: 3, enabled: true },
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/prose list', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Workflows:');
    expect(emitted[0]).toContain('Daily Ops');
  });

  it('/prose compile compiles a local .prose program into native workflow steps', async () => {
    const proseDir = path.join(process.cwd(), 'storage', 'prose');
    await fs.mkdir(proseDir, { recursive: true });
    const prosePath = path.join(proseDir, 'demo.prose');
    await fs.writeFile(
      prosePath,
      [
        '# Weekly Review',
        '',
        'input topic: "release readiness"',
        '',
        'agent researcher:',
        '  model: sonnet',
        '  prompt: "Research thoroughly."',
        '',
        'parallel:',
        '  findings = session: researcher',
        '    prompt: "Research {topic}."',
        '',
        'session "Summarize findings into one answer."',
        'context: { findings }',
        '',
      ].join('\n'),
      'utf8',
    );

    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/prose compile demo.prose', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('OpenProse compiled: Weekly Review');
    expect(emitted[0]).toContain('steps: 2');
    expect(emitted[0]).toContain('edges: 1');

    await fs.rm(prosePath).catch(() => {});
  });

  it('/agent status reports paused/nudge state', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('FROM session_settings')) {
          return { rows: [{ agent_paused: true, nudge_nonce: 2, last_nudged_at: '2026-02-23T08:00:00.000Z' }] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/agent status', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Agent state:');
    expect(emitted[0]).toContain('paused: yes');
    expect(emitted[0]).toContain('nudge_nonce: 2');
  });

  it('/pause toggles agent_paused on for the chat', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('INSERT INTO session_settings') && sql.includes('agent_paused')) {
          expect(params).toEqual(['chat-1', true, 'user-1']);
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/pause', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Agent paused for this chat.');
  });

  it('/resume toggles agent_paused off for the chat', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('INSERT INTO session_settings') && sql.includes('agent_paused')) {
          expect(params).toEqual(['chat-1', false, 'user-1']);
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/resume', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Agent resumed for this chat.');
  });

  it('/nudge bumps nonce and republishes latest task-like message', async () => {
    const published: any[] = [];
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('INSERT INTO session_settings') && sql.includes('nudge_nonce')) {
          return { rows: [{ nudge_nonce: 3, last_nudged_at: '2026-02-23T08:10:00.000Z' }] };
        }
        if (sql.includes('FROM messages') && sql.includes("role = 'user'")) {
          return { rows: [{ text: 'please retry weather lookup' }] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/nudge', sender_identity_id: 'id-1', metadata: {} } as any,
      userId: 'user-1',
      publishInbound: async (event: any) => {
        published.push(event);
      },
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Agent nudged');
    expect(emitted[0]).toContain('replaying latest task message');
    expect(published.length).toBe(1);
    expect(published[0].text).toBe('please retry weather lookup');
    expect(published[0].metadata.nudge).toBe(true);
    expect(published[0].metadata.nudge_nonce).toBe(3);
  });

  it('/kill detaches subagent from current chat without global agent mutation', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT role FROM users WHERE id = $1')) return { rows: [{ role: 'admin' }] };
        if (sql.includes('DELETE FROM agent_sessions')) return { rows: [{ agent_id: 'agent-b' }] };
        if (sql.includes('UPDATE agents')) return { rows: [] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/kill agent-b', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('removed from this chat');
    const calls = (pool.query as jest.Mock).mock.calls.map(([sql]) => String(sql));
    expect(calls.some((sql) => sql.includes('DELETE FROM agent_sessions'))).toBe(true);
    expect(calls.some((sql) => sql.includes('UPDATE agents'))).toBe(false);
  });

  it('/relay snapshots from source and displays on target deterministically', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT organization_id FROM chats')) return { rows: [{ organization_id: 'org-1' }] };
        if (sql.includes('FROM devices') && sql.includes('LOWER(name) = LOWER($2)')) {
          const ref = String((params || [])[1] || '');
          if (ref.toLowerCase() === 'kitchen') return { rows: [{ id: 'dev-src', name: 'Kitchen' }] };
          if (ref.toLowerCase() === 'office') return { rows: [{ id: 'dev-tgt', name: 'Office' }] };
          return { rows: [] };
        }
        if (sql.includes("VALUES ($1, 'camera_snapshot'")) {
          return { rows: [{ id: 'cmd-snap-1', status: 'pending' }] };
        }
        if (sql.includes('SELECT status, result_payload, error_message') && sql.includes('FROM device_commands')) {
          return {
            rows: [
              {
                status: 'acknowledged',
                result_payload: { image_base64: 'YmFzZTY0LWltYWdl' },
                error_message: null,
              },
            ],
          };
        }
        if (sql.includes("VALUES ($1, 'display'")) {
          return { rows: [{ id: 'cmd-disp-1', status: 'pending' }] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/relay kitchen -> office 320x180 timeout=25000', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Relay complete: Kitchen -> Office');
    expect(emitted[0]).toContain('snapshot_command_id: cmd-snap-1');
    expect(emitted[0]).toContain('display_command_id: cmd-disp-1');
    const calls = (pool.query as jest.Mock).mock.calls.map(([sql]) => String(sql));
    expect(calls.some((sql) => sql.includes("VALUES ($1, 'camera_snapshot'"))).toBe(true);
    expect(calls.some((sql) => sql.includes("VALUES ($1, 'display'"))).toBe(true);
  });

  it('/camrelay alias routes through the same relay flow', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT organization_id FROM chats')) return { rows: [{ organization_id: 'org-1' }] };
        if (sql.includes('FROM devices') && sql.includes('LOWER(name) = LOWER($2)')) {
          const ref = String((params || [])[1] || '');
          if (ref.toLowerCase() === 'kitchen') return { rows: [{ id: 'dev-src', name: 'Kitchen' }] };
          if (ref.toLowerCase() === 'office') return { rows: [{ id: 'dev-tgt', name: 'Office' }] };
          return { rows: [] };
        }
        if (sql.includes("VALUES ($1, 'camera_snapshot'")) {
          return { rows: [{ id: 'cmd-snap-4', status: 'pending' }] };
        }
        if (sql.includes('SELECT status, result_payload, error_message') && sql.includes('FROM device_commands')) {
          return {
            rows: [
              {
                status: 'acknowledged',
                result_payload: { image_base64: 'Y2FtcmVsYXk=' },
                error_message: null,
              },
            ],
          };
        }
        if (sql.includes("VALUES ($1, 'display'")) {
          return { rows: [{ id: 'cmd-disp-4', status: 'pending' }] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/camrelay kitchen -> office', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Relay complete: Kitchen -> Office');
    expect(emitted[0]).toContain('snapshot_command_id: cmd-snap-4');
    expect(emitted[0]).toContain('display_command_id: cmd-disp-4');
  });

  it('/handoff pushes scene continuity payload to target mirror device', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT organization_id FROM chats')) return { rows: [{ organization_id: 'org-1' }] };
        if (sql.includes('FROM devices') && sql.includes('LOWER(name) = LOWER($2)')) {
          const ref = String((params || [])[1] || '');
          if (ref.toLowerCase() === 'office') return { rows: [{ id: 'dev-tgt', name: 'Office' }] };
          return { rows: [] };
        }
        if (sql.includes('FROM messages') && sql.includes('ORDER BY created_at DESC')) {
          return {
            rows: [
              { role: 'assistant', text: 'Use hallway camera for motion checks.', created_at: '2026-03-12T10:00:00.000Z' },
              { role: 'user', text: 'Show me hallway status on the mirror.', created_at: '2026-03-12T09:59:00.000Z' },
            ],
          };
        }
        if (sql.includes("VALUES ($1, 'display'")) {
          const payload = (params || [])[1] as string;
          expect(payload).toContain('"type":"scene"');
          expect(payload).toContain('"scene":"ops_dashboard"');
          expect(payload).toContain('hallway');
          return { rows: [{ id: 'cmd-handoff-1', status: 'pending' }] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/handoff office continue hallway monitoring', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Handoff pushed to Office.');
    expect(emitted[0]).toContain('display_command_id: cmd-handoff-1');
  });

  it('/handoff returns usage when target is missing', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/handoff', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Usage: /handoff <target> [note...]');
  });

  it('/mirrorpersona pushes mood/cue scene payload to target mirror', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT organization_id FROM chats')) return { rows: [{ organization_id: 'org-1' }] };
        if (sql.includes('FROM devices') && sql.includes('LOWER(name) = LOWER($2)')) {
          const ref = String((params || [])[1] || '');
          if (ref.toLowerCase() === 'office') return { rows: [{ id: 'dev-tgt', name: 'Office' }] };
          return { rows: [] };
        }
        if (sql.includes("VALUES ($1, 'display'")) {
          const payload = String((params || [])[1] || '');
          expect(payload).toContain('"type":"scene"');
          expect(payload).toContain('"sync_type":"persona"');
          expect(payload).toContain('"mood":"speaking"');
          expect(payload).toContain('Keep cadence calm');
          return { rows: [{ id: 'cmd-persona-1', status: 'pending' }] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/mirrorpersona office mood=speaking state=briefing cue=Keep cadence calm', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Mirror persona synced to Office.');
    expect(emitted[0]).toContain('display_command_id: cmd-persona-1');
    expect(emitted[0]).toContain('mood: speaking');
  });

  it('/mirrorpersona rejects invalid mood values', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/mirrorpersona office mood=angry cue=test', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Invalid mood "angry"');
  });

  it('/relay returns usage when arrow separator is missing', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/relay kitchen office', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Usage: /relay <source> -> <target> [widthxheight] [timeout=ms]');
  });

  it('natural relay phrase maps deterministically to relay command flow', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT organization_id FROM chats')) return { rows: [{ organization_id: 'org-1' }] };
        if (sql.includes('FROM devices') && sql.includes('LOWER(name) = LOWER($2)')) {
          const ref = String((params || [])[1] || '');
          if (ref.toLowerCase() === 'kitchen') return { rows: [{ id: 'dev-src', name: 'Kitchen' }] };
          if (ref.toLowerCase() === 'office') return { rows: [{ id: 'dev-tgt', name: 'Office' }] };
          return { rows: [] };
        }
        if (sql.includes("VALUES ($1, 'camera_snapshot'")) {
          return { rows: [{ id: 'cmd-snap-2', status: 'pending' }] };
        }
        if (sql.includes('SELECT status, result_payload, error_message') && sql.includes('FROM device_commands')) {
          return {
            rows: [
              {
                status: 'acknowledged',
                result_payload: { image_base64: 'ZmFrZS1pbWFnZS1iNjQ=' },
                error_message: null,
              },
            ],
          };
        }
        if (sql.includes("VALUES ($1, 'display'")) {
          return { rows: [{ id: 'cmd-disp-2', status: 'pending' }] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: 'show kitchen cam on office screen', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Relay complete: Kitchen -> Office');
    const calls = (pool.query as jest.Mock).mock.calls.map(([sql]) => String(sql));
    expect(calls.some((sql) => sql.includes("VALUES ($1, 'camera_snapshot'"))).toBe(true);
    expect(calls.some((sql) => sql.includes("VALUES ($1, 'display'"))).toBe(true);
  });

  it('natural mirror display phrase routes to a display command', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT organization_id FROM chats')) return { rows: [{ organization_id: 'org-1' }] };
        if (sql.includes('FROM devices') && sql.includes('LOWER(name) = LOWER($2)')) {
          const ref = String((params || [])[1] || '');
          if (ref.toLowerCase() === 'office') return { rows: [{ id: 'dev-tgt', name: 'Office' }] };
          return { rows: [] };
        }
        if (sql.includes("VALUES ($1, 'display'")) {
          const payload = String((params || [])[1] || '');
          expect(payload).toContain('"type":"text"');
          expect(payload).toContain('release status');
          return { rows: [{ id: 'cmd-display-1', status: 'pending' }] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: 'show release status on office screen', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Display pushed to Office.');
    expect(emitted[0]).toContain('display_command_id: cmd-display-1');
  });

  it('relay resolves semantic device names like Dell Kitchen Screen Live from kitchen', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT organization_id FROM chats')) return { rows: [{ organization_id: 'org-1' }] };
        if (sql.includes('FROM devices') && sql.includes('LOWER(name) = LOWER($2)')) {
          return { rows: [] };
        }
        if (sql.includes('FROM devices') && sql.includes('WHERE organization_id = $1')) {
          return {
            rows: [
              {
                id: 'dev-older',
                name: 'Dell Kitchen Screen',
                status: 'online',
                last_seen_at: '2026-03-25T18:40:55.000Z',
                updated_at: '2026-03-25T18:40:55.000Z',
              },
              {
                id: 'dev-kitchen',
                name: 'Dell Kitchen Screen Live',
                status: 'online',
                last_seen_at: '2026-03-25T19:17:55.000Z',
                updated_at: '2026-03-25T19:17:55.000Z',
              },
            ],
          };
        }
        if (sql.includes("VALUES ($1, 'camera_snapshot'")) {
          return { rows: [{ id: 'cmd-snap-kitchen', status: 'pending' }] };
        }
        if (sql.includes('SELECT status, result_payload, error_message') && sql.includes('FROM device_commands')) {
          return {
            rows: [
              {
                status: 'acknowledged',
                result_payload: { image_base64: 'ZmFrZS1pbWFnZS1iNjQ=' },
                error_message: null,
              },
            ],
          };
        }
        if (sql.includes("VALUES ($1, 'display'")) {
          return { rows: [{ id: 'cmd-disp-kitchen', status: 'pending' }] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: 'show kitchen cam on kitchen screen', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Relay complete: Dell Kitchen Screen Live -> Dell Kitchen Screen Live');
  });

  it('plain non-command text is still not handled as command', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        return { rows: [] };
      }),
    } as any;

    const canvasEmitter = { emit: jest.fn(async () => {}) } as any;
    const handled = await handleChatCommand({
      pool,
      canvasEmitter,
      event: { chat_id: 'chat-1', channel: 'test', text: 'hello there', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(false);
    expect(canvasEmitter.emit).not.toHaveBeenCalled();
  });

  it('natural relay supports "from source to target" phrasing', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT organization_id FROM chats')) return { rows: [{ organization_id: 'org-1' }] };
        if (sql.includes('FROM devices') && sql.includes('LOWER(name) = LOWER($2)')) {
          const ref = String((params || [])[1] || '');
          if (ref.toLowerCase() === 'kitchen') return { rows: [{ id: 'dev-src', name: 'Kitchen' }] };
          if (ref.toLowerCase() === 'office') return { rows: [{ id: 'dev-tgt', name: 'Office' }] };
          return { rows: [] };
        }
        if (sql.includes("VALUES ($1, 'camera_snapshot'")) {
          return { rows: [{ id: 'cmd-snap-3', status: 'pending' }] };
        }
        if (sql.includes('SELECT status, result_payload, error_message') && sql.includes('FROM device_commands')) {
          return {
            rows: [
              {
                status: 'acknowledged',
                result_payload: { image_base64: 'aW1hZ2UtZGF0YQ==' },
                error_message: null,
              },
            ],
          };
        }
        if (sql.includes("VALUES ($1, 'display'")) {
          return { rows: [{ id: 'cmd-disp-3', status: 'pending' }] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: 'relay camera from kitchen to office 320x180 timeout=20000', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Relay complete: Kitchen -> Office');
    expect(emitted[0]).toContain('timeout_ms: 20000');
  });

  it('natural relay stays fail-closed on ambiguous source/target wording', async () => {
    const pool = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        return { rows: [] };
      }),
    } as any;

    const canvasEmitter = { emit: jest.fn(async () => {}) } as any;
    const handled = await handleChatCommand({
      pool,
      canvasEmitter,
      event: { chat_id: 'chat-1', channel: 'test', text: 'camera kitchen office now', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(false);
    expect(canvasEmitter.emit).not.toHaveBeenCalled();
  });

  it('/compact uses active-memory + user-scoped visibility filters', async () => {
    const pool = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM settings_global WHERE key = 'chat.commands.prefix'")) return { rows: [] };
        if (sql.includes('SELECT id, role, text, created_at') && sql.includes('FROM messages')) {
          return {
            rows: Array.from({ length: 12 }).map((_, i) => ({
              id: `m-${i}`,
              role: i % 2 === 0 ? 'user' : 'assistant',
              text: `message ${i}`,
              created_at: new Date(Date.now() - (12 - i) * 1000).toISOString(),
            })),
          };
        }
        if (sql.includes('FROM memories')) {
          expect(sql).toContain("visibility = 'global'");
          expect(sql).toContain("visibility = 'chat_shared' AND chat_id = $1");
          expect(sql).toContain("visibility = 'user_private' AND user_id = $2");
          expect(sql).toContain('archived_at IS NULL');
          expect(sql).toContain('merged_into IS NULL');
          expect(params).toEqual(['chat-1', 'user-1']);
          return { rows: [{ key: 'profile.name', value: 'Sven' }] };
        }
        if (sql.includes('FROM tool_runs')) return { rows: [] };
        if (sql.includes('INSERT INTO messages')) return { rows: [] };
        if (sql.includes('INSERT INTO compaction_events')) return { rows: [] };
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
      event: { chat_id: 'chat-1', channel: 'test', text: '/compact', sender_identity_id: 'id-1' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Compaction complete');
  });
});
