export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const e = error as {
    body?: { error?: { message?: unknown }; message?: unknown };
    message?: unknown;
  };
  const bodyMessage = e.body?.error?.message;
  if (typeof bodyMessage === 'string' && bodyMessage.trim()) return bodyMessage;
  const altBodyMessage = e.body?.message;
  if (typeof altBodyMessage === 'string' && altBodyMessage.trim()) return altBodyMessage;
  const msg = e.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return fallback;
}

