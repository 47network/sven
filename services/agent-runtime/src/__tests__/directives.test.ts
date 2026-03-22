import { describe, expect, it, jest } from '@jest/globals';
import { handleChatCommand, consumeNextThinkLevel } from '../chat-commands.js';

describe('inline directives', () => {
  it('supports sven: directive syntax', async () => {
    const pool = {
      query: jest.fn(async () => ({ rows: [] })),
    } as any;

    const emitted: string[] = [];
    const canvasEmitter = {
      emit: jest.fn(async (payload: any) => {
        emitted.push(String(payload.text || ''));
      }),
    } as any;

    const event = {
      chat_id: 'chat-1',
      channel: 'test',
      text: 'sven: think low',
      sender_identity_id: 'identity-1',
    } as any;

    const handled = await handleChatCommand({
      pool,
      canvasEmitter,
      event,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(consumeNextThinkLevel('chat-1')).toBe('low');
    expect(emitted[0]).toContain('next reply');
  });
});

