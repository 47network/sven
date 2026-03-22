export interface RuntimeToolCall {
  name: string;
  scope?: string;
  run_id: string;
  inputs: Record<string, unknown>;
  justification?: Record<string, unknown>;
  [key: string]: unknown;
}

interface NormalizedToolCalls {
  toolCalls: RuntimeToolCall[];
  droppedCount: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeToolCalls(value: unknown): NormalizedToolCalls {
  if (value === undefined || value === null) {
    return { toolCalls: [], droppedCount: 0 };
  }
  if (!Array.isArray(value)) {
    return { toolCalls: [], droppedCount: 1 };
  }

  const toolCalls: RuntimeToolCall[] = [];
  let droppedCount = 0;

  for (const entry of value) {
    if (!isPlainObject(entry)) {
      droppedCount += 1;
      continue;
    }

    const name = normalizeNonEmptyString(entry.name);
    const runId = normalizeNonEmptyString(entry.run_id);
    if (!name || !runId) {
      droppedCount += 1;
      continue;
    }

    if (!isPlainObject(entry.inputs)) {
      droppedCount += 1;
      continue;
    }

    const scope = entry.scope === undefined ? undefined : normalizeNonEmptyString(entry.scope);
    if (entry.scope !== undefined && !scope) {
      droppedCount += 1;
      continue;
    }

    if (entry.justification !== undefined && !isPlainObject(entry.justification)) {
      droppedCount += 1;
      continue;
    }

    toolCalls.push({
      ...entry,
      name,
      run_id: runId,
      inputs: entry.inputs,
      ...(scope ? { scope } : {}),
      ...(entry.justification ? { justification: entry.justification } : {}),
    });
  }

  return { toolCalls, droppedCount };
}

