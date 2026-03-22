export function resolveToolExecutionTimeoutMs(rawSeconds: unknown): number {
  const DEFAULT_MS = 30_000;
  const MIN_MS = 1_000;
  const MAX_MS = 600_000;
  const parsed = Number(rawSeconds);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MS;
  }
  const normalizedMs = Math.floor(parsed * 1000);
  return Math.max(MIN_MS, Math.min(MAX_MS, normalizedMs));
}
