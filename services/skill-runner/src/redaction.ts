export type RedactionConfig = {
  enabled: boolean;
  mask: string;
  patterns: RegExp[];
};

export const REDACTION_CYCLE_MARKER = '[REDACTION_CYCLE]';
export const REDACTION_DEPTH_MARKER = '[REDACTION_DEPTH_LIMIT]';
export const REDACTION_ERROR_MARKER = '[REDACTION_ERROR]';

type RedactionOptions = {
  maxDepth?: number;
};

function redactValueInternal(
  value: unknown,
  config: RedactionConfig,
  depth: number,
  maxDepth: number,
  seen: WeakSet<object>,
): unknown {
  if (!config.enabled) {
    return value;
  }
  if (depth >= maxDepth) {
    return REDACTION_DEPTH_MARKER;
  }
  if (typeof value === 'string') {
    return redactStringValue(value, config);
  }
  if (Array.isArray(value)) {
    const arrRef = value as unknown as object;
    if (seen.has(arrRef)) {
      return REDACTION_CYCLE_MARKER;
    }
    seen.add(arrRef);
    return value.map((entry) => redactValueInternal(entry, config, depth + 1, maxDepth, seen));
  }
  if (value && typeof value === 'object') {
    const objRef = value as object;
    if (seen.has(objRef)) {
      return REDACTION_CYCLE_MARKER;
    }
    seen.add(objRef);
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      try {
        const entry = (value as Record<string, unknown>)[key];
        output[key] = redactValueInternal(entry, config, depth + 1, maxDepth, seen);
      } catch {
        output[key] = REDACTION_ERROR_MARKER;
      }
    }
    return output;
  }
  return value;
}

export function redactStringValue(value: string, config: RedactionConfig): string {
  if (!config.enabled || config.patterns.length === 0) {
    return value;
  }
  let redacted = value;
  for (const pattern of config.patterns) {
    redacted = redacted.replace(pattern, config.mask);
  }
  return redacted;
}

export function redactValueSafe(
  value: unknown,
  config: RedactionConfig,
  options?: RedactionOptions,
): unknown {
  const maxDepth = Math.max(1, Math.min(64, Number(options?.maxDepth || 16)));
  try {
    return redactValueInternal(value, config, 0, maxDepth, new WeakSet<object>());
  } catch {
    return REDACTION_ERROR_MARKER;
  }
}
