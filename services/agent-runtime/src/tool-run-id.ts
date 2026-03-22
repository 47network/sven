import { v7 as uuidv7 } from 'uuid';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeToolRunId(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (UUID_REGEX.test(trimmed)) {
      return trimmed;
    }
  }
  return uuidv7();
}

