/**
 * Type-prefixed task ID generation.
 *
 * Each task type gets a single-character prefix followed by 12 random
 * alphanumeric characters (36^12 ≈ 4.7 × 10^18 combinations).
 *
 * Pattern: {prefix}{12 random chars}
 * Examples: t-a8k3m9p2x4z1  (tool run)
 *           a-f7j2n5q8v3y6  (agent turn)
 *           w-b4l1o6r9u2x5  (workflow run)
 *
 * Prior art: Stripe prefix IDs (ch_, cus_, pi_), Datadog trace IDs,
 * finite state machine theory (typed state identifiers).
 */

import { randomBytes } from 'crypto';

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 12;

/**
 * Known task ID types and their single-character prefix.
 */
export const TASK_ID_PREFIXES = {
  tool_run: 't',
  agent_turn: 'a',
  workflow_run: 'w',
  approval: 'p',
  notification: 'n',
  coordinator_task: 'c',
  bridge_request: 'b',
  skill_exec: 's',
  audit_entry: 'u',
  outbox_item: 'o',
  message: 'm',
  identity: 'i',
  memory: 'y',
  event_envelope: 'e',
  improvement: 'v',
  catalog_entry: 'g',
} as const;

export type TaskIdType = keyof typeof TASK_ID_PREFIXES;

/**
 * Generate a type-prefixed task ID.
 *
 * @param type - The task type (determines prefix character)
 * @returns A string like "t-a8k3m9p2x4z1"
 */
export function generateTaskId(type: TaskIdType): string {
  const prefix = TASK_ID_PREFIXES[type];
  const alphabetLen = ID_ALPHABET.length;
  const limit = 256 - (256 % alphabetLen);
  const bytes = randomBytes(ID_LENGTH * 2);
  let id = `${prefix}-`;
  let j = 0;
  for (let i = 0; i < ID_LENGTH; ) {
    if (j >= bytes.length) {
      const extra = randomBytes(ID_LENGTH * 2);
      j = 0;
      bytes.set ? bytes.set(extra) : extra.copy(bytes);
    }
    const b = bytes[j++]!;
    if (b < limit) {
      id += ID_ALPHABET[b % alphabetLen];
      i++;
    }
  }
  return id;
}

/**
 * Extract the task type from a prefixed task ID.
 * Returns undefined if the prefix is not recognized.
 */
export function parseTaskIdType(id: string): TaskIdType | undefined {
  if (!id || id.length < 3 || id[1] !== '-') return undefined;
  const prefix = id[0];
  for (const [type, p] of Object.entries(TASK_ID_PREFIXES)) {
    if (p === prefix) return type as TaskIdType;
  }
  return undefined;
}

/**
 * Validate that a string looks like a valid task ID.
 */
export function isValidTaskId(id: string): boolean {
  if (!id || id.length !== ID_LENGTH + 2) return false;
  if (id[1] !== '-') return false;
  const suffix = id.slice(2);
  for (let i = 0; i < suffix.length; i++) {
    if (!ID_ALPHABET.includes(suffix[i]!)) return false;
  }
  return parseTaskIdType(id) !== undefined;
}
