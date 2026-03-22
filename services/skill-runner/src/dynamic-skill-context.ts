export function resolveDynamicSkillAuthoringContext(input: {
  payloadUserId: unknown;
  payloadChatId: unknown;
  runContextUserId: unknown;
  runContextChatId: unknown;
}): { ok: boolean; userId?: string; chatId?: string; error?: string } {
  const authUserId = String(input.runContextUserId || '').trim();
  const authChatId = String(input.runContextChatId || '').trim();
  if (!authUserId) {
    return { ok: false, error: 'Authenticated user context is required for dynamic skill creation' };
  }
  if (!authChatId) {
    return { ok: false, error: 'Authenticated chat context is required for dynamic skill creation' };
  }

  const requestedUserId = String(input.payloadUserId || '').trim();
  if (requestedUserId && requestedUserId !== authUserId) {
    return { ok: false, error: 'inputs.user_id does not match authenticated user context' };
  }

  const requestedChatId = String(input.payloadChatId || '').trim();
  if (requestedChatId && requestedChatId !== authChatId) {
    return { ok: false, error: 'inputs.chat_id does not match authenticated chat context' };
  }

  return { ok: true, userId: authUserId, chatId: authChatId };
}
