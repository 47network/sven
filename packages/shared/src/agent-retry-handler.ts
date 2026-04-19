// Batch 202: Retry Handler — retry policies, backoff, dead-letter queues

export interface RetryPolicy {
  id: string;
  agentId: string;
  policyName: string;
  targetService: string;
  maxRetries: number;
  backoffStrategy: BackoffStrategy;
  initialDelayMs: number;
  maxDelayMs: number;
  retryOnStatus: number[];
  retryOnErrors: string[];
  timeoutMs: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

export interface RetryAttempt {
  id: string;
  policyId: string;
  requestId: string;
  attemptNumber: number;
  statusCode?: number;
  errorMessage?: string;
  delayMs: number;
  durationMs: number;
  succeeded: boolean;
  metadata: Record<string, unknown>;
  attemptedAt: string;
}

export interface DeadLetterEntry {
  id: string;
  policyId: string;
  requestId: string;
  originalPayload: Record<string, unknown>;
  lastError?: string;
  totalAttempts: number;
  reprocessed: boolean;
  reprocessedAt?: string;
  expiredAt?: string;
}

export type BackoffStrategy = 'fixed' | 'linear' | 'exponential' | 'jitter' | 'fibonacci';
export type RetryHandlerEvent = 'retry.policy_created' | 'retry.attempt_failed' | 'retry.exhausted' | 'retry.dlq_entry_added';
