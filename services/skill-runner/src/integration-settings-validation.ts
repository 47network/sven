function parseSettingValue<T = unknown>(value: unknown): T {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed) as T;
      } catch {
        return value as T;
      }
    }
  }
  return value as T;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBooleanLike(value: unknown): boolean {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'false' || normalized === '1' || normalized === '0';
  }
  return false;
}

function isHttpUrl(value: unknown): boolean {
  if (!isNonEmptyString(value)) return false;
  try {
    const parsed = new URL((value as string).trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidConfiguredIntegrationSetting(key: string, rawValue: unknown): boolean {
  const parsed = parseSettingValue(rawValue);
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return false;

  if (normalizedKey.endsWith('_token_ref') || normalizedKey.endsWith('_secret_ref') || normalizedKey.endsWith('_key_ref')) {
    return isNonEmptyString(parsed);
  }
  if (normalizedKey.endsWith('.base_url') || normalizedKey.endsWith('ApiUrl') || normalizedKey.endsWith('.api_url')) {
    return isHttpUrl(parsed);
  }
  if (normalizedKey.endsWith('Enabled')) {
    return isBooleanLike(parsed);
  }
  if (normalizedKey.endsWith('.vault_path') || normalizedKey.endsWith('.client_id')) {
    return isNonEmptyString(parsed);
  }
  if (typeof parsed === 'string') return parsed.trim().length > 0;
  if (typeof parsed === 'boolean') return true;
  return false;
}
