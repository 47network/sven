import { describe, expect, it, jest } from '@jest/globals';
import { handleChatCommand } from '../chat-commands.js';

describe('/model command', () => {
  function makePool(role = 'admin', modelPickerEnabled = true, currentModel: string | null = 'gpt-4o-mini') {
    return {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM settings_global WHERE key = \'chat.commands.prefix\'')) {
          return { rows: [] };
        }
        if (sql.includes('FROM settings_global WHERE key = \'chat.modelPicker.enabled\'')) {
          return { rows: [{ value: modelPickerEnabled ? 'true' : 'false' }] };
        }
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [{ role }] };
        }
        if (sql.includes('FROM session_settings')) {
          return { rows: currentModel ? [{ model_name: currentModel }] : [] };
        }
        if (sql.includes('FROM model_registry')) {
          return {
            rows: [
              { name: 'OpenAI GPT-4o Mini', provider: 'openai', model_id: 'gpt-4o-mini' },
              { name: 'Anthropic Sonnet', provider: 'anthropic', model_id: 'claude-3-5-sonnet' },
            ],
          };
        }
        if (sql.includes('INSERT INTO session_settings')) {
          return { rows: [] };
        }
        if (sql.includes('UPDATE session_settings')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    } as any;
  }

  it('lists available models with numbering', async () => {
    const pool = makePool();
    const emitted: string[] = [];
    const canvasEmitter = {
      emit: jest.fn(async (payload: any) => {
        emitted.push(String(payload.text || ''));
      }),
    } as any;

    const handled = await handleChatCommand({
      pool,
      canvasEmitter,
      event: { chat_id: 'chat-1', channel: 'test', text: '/model list' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Available models:');
    expect(emitted[0]).toContain('1. openai/gpt-4o-mini');
  });

  it('shows current model override', async () => {
    const pool = makePool('admin', true, 'claude-3-5-sonnet');
    const emitted: string[] = [];
    const canvasEmitter = {
      emit: jest.fn(async (payload: any) => {
        emitted.push(String(payload.text || ''));
      }),
    } as any;

    const handled = await handleChatCommand({
      pool,
      canvasEmitter,
      event: { chat_id: 'chat-1', channel: 'test', text: '/model current' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Current model override: claude-3-5-sonnet.');
  });

  it('resolves alias to model id before saving override', async () => {
    const pool = makePool();
    const emitted: string[] = [];
    const canvasEmitter = {
      emit: jest.fn(async (payload: any) => {
        emitted.push(String(payload.text || ''));
      }),
    } as any;

    const handled = await handleChatCommand({
      pool,
      canvasEmitter,
      event: { chat_id: 'chat-1', channel: 'test', text: '/model gpt-mini' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Switched to model: gpt-4o-mini.');
  });

  it('blocks non-admins from switching models', async () => {
    const pool = makePool('user');
    const emitted: string[] = [];
    const canvasEmitter = {
      emit: jest.fn(async (payload: any) => {
        emitted.push(String(payload.text || ''));
      }),
    } as any;

    const handled = await handleChatCommand({
      pool,
      canvasEmitter,
      event: { chat_id: 'chat-1', channel: 'test', text: '/model gpt-mini' } as any,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(emitted[0]).toContain('Only admins can change the active model.');
  });
});
