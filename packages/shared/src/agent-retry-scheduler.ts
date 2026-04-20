export type BackoffStrategy = 'fixed' | 'linear' | 'exponential' | 'fibonacci';
export type RetryAttemptStatus = 'pending' | 'retrying' | 'succeeded' | 'exhausted' | 'cancelled';

export interface RetrySchedulerConfig {
  id: string;
  agentId: string;
  maxRetries: number;
  backoffStrategy: BackoffStrategy;
  baseDelayMs: number;
  maxDelayMs: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RetryPolicyDef {
  id: string;
  configId: string;
  name: string;
  targetService: string;
  errorCodes: string[];
  retryCount: number;
  active: boolean;
  createdAt: string;
}

export interface RetryAttempt {
  id: string;
  policyId: string;
  originalRequestId: string;
  attemptNumber: number;
  status: RetryAttemptStatus;
  errorMessage?: string;
  nextRetryAt?: string;
  createdAt: string;
}
