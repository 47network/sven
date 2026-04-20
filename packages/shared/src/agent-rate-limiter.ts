export type AgentRateLimitPolicy = 'token_bucket' | 'sliding_window' | 'fixed_window' | 'leaky_bucket';

export interface AgentRateLimiterConfig {
  id: string;
  agentId: string;
  name: string;
  policy: AgentRateLimitPolicy;
  maxTokens: number;
  refillRate: number;
  refillIntervalMs: number;
  currentTokens: number;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRateBucket {
  id: string;
  limiterId: string;
  bucketKey: string;
  tokensRemaining: number;
  lastRefillAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRateViolation {
  id: string;
  limiterId: string;
  bucketId: string | null;
  agentId: string;
  action: string;
  tokensRequested: number;
  tokensAvailable: number;
  retryAfterMs: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentRateLimiterStats {
  totalLimiters: number;
  activeLimiters: number;
  totalBuckets: number;
  totalViolations: number;
  avgTokensRemaining: number;
  violationRate: number;
}
