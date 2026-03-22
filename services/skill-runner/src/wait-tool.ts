export type WaitInputs = Record<string, unknown>;

const DEFAULT_WAIT_MS = 1000;
const MAX_WAIT_MS = 300000;

function parseWaitMs(inputs: WaitInputs): { ok: true; waitMs: number } | { ok: false; error: string } {
  const delayMsRaw = inputs.delay_ms ?? inputs.duration_ms;
  const secondsRaw = inputs.seconds;

  let waitMs = DEFAULT_WAIT_MS;
  if (delayMsRaw !== undefined) {
    const parsed = Number(delayMsRaw);
    if (!Number.isFinite(parsed)) {
      return { ok: false, error: 'delay_ms must be a finite number' };
    }
    waitMs = Math.round(parsed);
  } else if (secondsRaw !== undefined) {
    const parsedSeconds = Number(secondsRaw);
    if (!Number.isFinite(parsedSeconds)) {
      return { ok: false, error: 'seconds must be a finite number' };
    }
    waitMs = Math.round(parsedSeconds * 1000);
  }

  if (waitMs < 0) {
    return { ok: false, error: 'wait duration must be >= 0' };
  }
  if (waitMs > MAX_WAIT_MS) {
    return { ok: false, error: `wait duration exceeds max ${MAX_WAIT_MS}ms` };
  }
  return { ok: true, waitMs };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeWaitFor(
  inputs: WaitInputs,
  deps?: { sleepFn?: (ms: number) => Promise<void>; now?: () => number },
): Promise<{ outputs: Record<string, unknown>; error?: string }> {
  const parsed = parseWaitMs(inputs);
  if (!parsed.ok) {
    return { outputs: {}, error: parsed.error };
  }

  const sleepFn = deps?.sleepFn || sleep;
  const now = deps?.now || Date.now;
  const startedAtMs = now();
  await sleepFn(parsed.waitMs);
  const endedAtMs = now();
  const actualWaitMs = Math.max(0, endedAtMs - startedAtMs);
  const reason = typeof inputs.reason === 'string' ? inputs.reason.trim().slice(0, 500) : '';

  return {
    outputs: {
      requested_wait_ms: parsed.waitMs,
      actual_wait_ms: actualWaitMs,
      started_at: new Date(startedAtMs).toISOString(),
      ended_at: new Date(endedAtMs).toISOString(),
      reason: reason || undefined,
    },
  };
}

