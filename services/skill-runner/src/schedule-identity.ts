export function resolveScheduleActorUserId(
  payloadUserId: unknown,
  runContextUserId: unknown,
): { ok: boolean; userId?: string; error?: string } {
  const authenticatedUserId = String(runContextUserId || '').trim();
  if (!authenticatedUserId) {
    return { ok: false, error: 'Authenticated user context is required' };
  }
  const requestedUserId = String(payloadUserId || '').trim();
  if (requestedUserId && requestedUserId !== authenticatedUserId) {
    return { ok: false, error: 'inputs.user_id does not match authenticated user context' };
  }
  return { ok: true, userId: authenticatedUserId };
}
