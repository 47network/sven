// ---------------------------------------------------------------------------
// Exponential-backoff retry utility (Batch 16)
// ---------------------------------------------------------------------------
// Used for cross-service calls (marketplace → treasury) that may transiently
// fail due to network issues, pod restarts, or database contention.
//
// Usage:
//   import { withRetry } from '@sven/shared';
//   const tx = await withRetry(() => fetch(treasuryUrl + '/credit', { ... }), {
//     maxAttempts: 3, baseDelayMs: 1000, label: 'treasury.credit',
//   });
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3. */
  maxAttempts?: number;
  /** Base delay in ms (doubled each retry). Default: 1000. */
  baseDelayMs?: number;
  /** Optional label for logging. */
  label?: string;
  /** Optional logger. */
  logger?: { warn: (msg: string, meta?: Record<string, unknown>) => void };
  /** Optional predicate: return true if the error is retryable. Default: always true. */
  isRetryable?: (err: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const label = opts.label ?? 'retry';
  const isRetryable = opts.isRetryable ?? (() => true);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !isRetryable(err)) {
        break;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      opts.logger?.warn(`${label}: attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`, {
        err: (err as Error).message,
        attempt,
        delay,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
