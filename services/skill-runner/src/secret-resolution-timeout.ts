export function resolveSecretTimeoutMs(
  rawValue: unknown,
  fallbackMs: number,
  minMs: number,
  maxMs: number,
): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.max(minMs, Math.min(maxMs, Math.floor(parsed)));
}

export function isSecretResolutionTimeoutError(error: unknown): boolean {
  const message = String((error as Error)?.message || error || '').toLowerCase();
  return message.includes('aborted') || message.includes('timeout') || message.includes('timed out');
}
