export function parseSettingValue<T = unknown>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return value as T;
}

export function parseBooleanSetting(
  value: unknown,
  fallback = false,
): boolean {
  const parsed = parseSettingValue(value);
  if (typeof parsed === 'boolean') return parsed;
  if (typeof parsed === 'number') {
    if (parsed === 1) return true;
    if (parsed === 0) return false;
    return fallback;
  }
  if (typeof parsed === 'string') {
    const normalized = parsed.trim().toLowerCase();
    if (['true', '1', 'on'].includes(normalized)) return true;
    if (['false', '0', 'off'].includes(normalized)) return false;
  }
  return fallback;
}
