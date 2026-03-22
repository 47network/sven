import { describe, expect, it, jest } from '@jest/globals';
import { handleChatCommand, consumeNextThinkLevel } from '../chat-commands.js';

describe('think level override', () => {
  it('applies for next reply only', async () => {
    const pool = {
      query: jest.fn(async () => ({ rows: [] })),
    } as any;

    const emitted: string[] = [];
    const canvasEmitter = {
      emit: jest.fn(async (payload: any) => {
        emitted.push(payload.text);
      }),
    } as any;

    const event = {
      chat_id: 'chat-1',
      channel: 'test',
      text: '/think high',
      sender_identity_id: 'identity-1',
    } as any;

    const handled = await handleChatCommand({
      pool,
      canvasEmitter,
      event,
      userId: 'user-1',
    });

    expect(handled).toBe(true);
    expect(consumeNextThinkLevel(event.chat_id)).toBe('high');
    expect(consumeNextThinkLevel(event.chat_id)).toBeNull();
    expect(emitted[0]).toContain('next reply');
  });
});
