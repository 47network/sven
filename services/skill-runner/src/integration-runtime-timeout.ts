const DEFAULT_INTEGRATION_EXEC_TIMEOUT_MS = 120000;
const MIN_INTEGRATION_EXEC_TIMEOUT_MS = 5000;
const MAX_INTEGRATION_EXEC_TIMEOUT_MS = 900000;

export function resolveIntegrationExecTimeoutMs(rawValue: unknown): number {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return DEFAULT_INTEGRATION_EXEC_TIMEOUT_MS;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_INTEGRATION_EXEC_TIMEOUT_MS;
  }
  const normalized = Math.trunc(parsed);
  if (normalized < MIN_INTEGRATION_EXEC_TIMEOUT_MS) return MIN_INTEGRATION_EXEC_TIMEOUT_MS;
  if (normalized > MAX_INTEGRATION_EXEC_TIMEOUT_MS) return MAX_INTEGRATION_EXEC_TIMEOUT_MS;
  return normalized;
}
