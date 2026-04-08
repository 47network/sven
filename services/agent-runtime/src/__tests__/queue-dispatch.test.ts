import { describe, expect, it } from '@jest/globals';
import { isMissingChatQueueDispatchError } from '../queue-dispatch.js';

describe('queue dispatch helpers', () => {
  it('matches missing-chat processing state foreign key errors', () => {
    expect(
      isMissingChatQueueDispatchError({
        code: '23503',
        constraint: 'chat_processing_state_chat_id_fkey',
      }),
    ).toBe(true);
  });

  it('matches stringified missing-chat processing state foreign key errors', () => {
    expect(
      isMissingChatQueueDispatchError(
        'insert or update on table "chat_processing_state" violates foreign key constraint "chat_processing_state_chat_id_fkey"',
      ),
    ).toBe(true);
  });

  it('ignores unrelated foreign key failures', () => {
    expect(
      isMissingChatQueueDispatchError({
        code: '23503',
        constraint: 'messages_sender_identity_id_fkey',
      }),
    ).toBe(false);
  });
});
