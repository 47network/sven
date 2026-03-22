import type { RedactionConfig } from './redaction.js';

function parseJsonLikeValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseStrictBoolean(value: unknown, fallback: boolean): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  }
  return fallback;
}

export function buildRedactionConfigFromSettings(settings: Map<string, unknown>): RedactionConfig {
  const enabledRaw = settings.has('redaction.enabled')
    ? parseJsonLikeValue(settings.get('redaction.enabled'))
    : false;
  const maskRaw = settings.has('redaction.mask')
    ? parseJsonLikeValue(settings.get('redaction.mask'))
    : '[REDACTED]';
  const patternsRaw = settings.has('redaction.patterns')
    ? parseJsonLikeValue(settings.get('redaction.patterns'))
    : [];

  const enabled = parseStrictBoolean(enabledRaw, false);
  const mask = typeof maskRaw === 'string' && maskRaw ? maskRaw : '[REDACTED]';
  const patterns = Array.isArray(patternsRaw)
    ? patternsRaw
      .filter((entry) => typeof entry === 'string' && entry.length > 0)
      .flatMap((pattern) => {
        try {
          return [new RegExp(pattern, 'gi')];
        } catch {
          return [];
        }
      })
    : [];
  return { enabled, mask, patterns };
}
