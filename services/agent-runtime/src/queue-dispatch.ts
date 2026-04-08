export function isMissingChatQueueDispatchError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '').trim();
  const constraint = String((err as { constraint?: string })?.constraint || '').trim().toLowerCase();
  const raw = String((err as Error)?.message || err || '').trim().toLowerCase();

  if (code === '23503' && constraint === 'chat_processing_state_chat_id_fkey') {
    return true;
  }

  return (
    raw.includes('chat_processing_state_chat_id_fkey') ||
    raw.includes('insert or update on table "chat_processing_state" violates foreign key constraint')
  );
}
