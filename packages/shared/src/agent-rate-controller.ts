export type RateLimitAlgorithm = 'token_bucket' | 'sliding_window' | 'fixed_window' | 'leaky_bucket';
export type ExceedAction = 'reject' | 'throttle' | 'queue' | 'log_only';

export interface AgentRateControllerConfig {
  id: string;
  agentId: string;
  controllerName: string;
  algorithm: RateLimitAlgorithm;
  defaultRateLimit: number;
  defaultBurstSize: number;
  windowSizeSeconds: number;
  metadata: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRateLimitRule {
  id: string;
  configId: string;
  ruleName: string;
  targetKey: string;
  rateLimit: number;
  burstSize: number;
  windowSeconds: number;
  actionOnExceed: ExceedAction;
  priority: number;
  enabled: boolean;
  createdAt: string;
}

export interface AgentRateLimitEvent {
  id: string;
  ruleId: string;
  clientKey: string;
  eventType: string;
  tokensRemaining: number | null;
  requestCount: number;
  occurredAt: string;
}
