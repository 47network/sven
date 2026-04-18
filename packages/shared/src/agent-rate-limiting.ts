export type RateLimitTarget = 'agent' | 'service' | 'api' | 'skill' | 'global' | 'ip' | 'user';

export type RateLimitStrategy = 'sliding_window' | 'fixed_window' | 'token_bucket' | 'leaky_bucket';

export type QuotaResource = 'tokens' | 'requests' | 'compute' | 'storage' | 'bandwidth' | 'cost';

export type ThrottleAction = 'delay' | 'reject' | 'queue' | 'degrade' | 'redirect';

export type ViolationType = 'rate_exceeded' | 'quota_exhausted' | 'burst_exceeded' | 'throttle_triggered' | 'policy_breach';

export interface RateLimitPolicy {
  id: string;
  name: string;
  targetType: RateLimitTarget;
  targetId?: string;
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  burstLimit: number;
  strategy: RateLimitStrategy;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RateLimitQuota {
  id: string;
  policyId: string;
  resourceType: QuotaResource;
  quotaLimit: number;
  quotaUsed: number;
  resetInterval: string;
  lastResetAt: string;
  overageAllowed: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ThrottleRule {
  id: string;
  policyId: string;
  condition: Record<string, unknown>;
  action: ThrottleAction;
  delayMs: number;
  priority: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RateUsageRecord {
  id: string;
  policyId: string;
  windowStart: string;
  windowEnd: string;
  requestCount: number;
  tokenCount: number;
  rejectedCount: number;
  avgLatencyMs: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RateViolation {
  id: string;
  policyId: string;
  violationType: ViolationType;
  severity: string;
  details: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isQuotaExhausted(q: RateLimitQuota): boolean {
  return q.quotaUsed >= q.quotaLimit && !q.overageAllowed;
}

export function quotaUtilization(q: RateLimitQuota): number {
  if (q.quotaLimit === 0) return 0;
  return q.quotaUsed / q.quotaLimit;
}

export function violationRate(violations: RateViolation[]): number {
  if (violations.length === 0) return 0;
  return violations.filter(v => !v.resolved).length / violations.length;
}
