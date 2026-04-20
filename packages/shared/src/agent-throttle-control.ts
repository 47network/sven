/* Batch 146 — Agent Throttle Control */

export enum ThrottleScope {
  Global = 'global',
  Agent = 'agent',
  Skill = 'skill',
  Endpoint = 'endpoint',
  Resource = 'resource',
}

export enum ThrottleMode {
  RateLimit = 'rate_limit',
  Concurrency = 'concurrency',
  Burst = 'burst',
  Adaptive = 'adaptive',
  CircuitBreaker = 'circuit_breaker',
}

export enum ThrottleAction {
  Allowed = 'allowed',
  Throttled = 'throttled',
  Queued = 'queued',
  Rejected = 'rejected',
  CircuitOpened = 'circuit_opened',
  CircuitClosed = 'circuit_closed',
}

export interface ThrottleRule {
  id: string;
  agentId: string;
  name: string;
  scope: ThrottleScope;
  mode: ThrottleMode;
  maxRate: number;
  windowSeconds: number;
  burstSize: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThrottleEvent {
  id: string;
  ruleId: string;
  agentId: string;
  action: ThrottleAction;
  requestKey?: string;
  currentRate: number;
  waitMs: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ThrottleCounter {
  id: string;
  ruleId: string;
  windowStart: Date;
  windowEnd: Date;
  requestCount: number;
  rejectedCount: number;
  avgLatencyMs: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ThrottleControlStats {
  totalRules: number;
  activeRules: number;
  totalAllowed: number;
  totalThrottled: number;
  avgRate: number;
  circuitBreakerTrips: number;
}
