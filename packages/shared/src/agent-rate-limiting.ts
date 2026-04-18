/* Batch 67 — Agent Rate Limiting & Throttling */

export type ResourceType = 'api' | 'task' | 'skill' | 'model' | 'storage' | 'network';
export type ThrottleStrategy = 'sliding_window' | 'fixed_window' | 'token_bucket' | 'leaky_bucket';
export type OverrideType = 'increase' | 'decrease' | 'exempt' | 'temporary';
export type ThrottleEventType = 'throttled' | 'blocked' | 'warned' | 'burst_exceeded' | 'quota_reset';
export type RateLimitAction = 'policy_create' | 'policy_update' | 'override_grant' | 'quota_allocate' | 'counter_check' | 'throttle_status' | 'quota_report';

export interface RateLimitPolicy {
  id: string;
  agentId?: string;
  policyName: string;
  resourceType: ResourceType;
  maxRequests: number;
  windowSeconds: number;
  burstLimit?: number;
  throttleStrategy: ThrottleStrategy;
  priority: number;
  enabled: boolean;
}

export interface RateLimitCounter {
  id: string;
  policyId: string;
  agentId: string;
  windowStart: string;
  windowEnd: string;
  requestCount: number;
  burstCount: number;
  lastRequestAt?: string;
}

export interface ThrottleEvent {
  id: string;
  policyId: string;
  agentId: string;
  eventType: ThrottleEventType;
  requestCount: number;
  limitValue: number;
  retryAfter?: number;
}

export interface QuotaAllocation {
  id: string;
  agentId: string;
  resourceType: ResourceType;
  allocated: number;
  consumed: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  autoRenew: boolean;
}

export interface RateLimitOverride {
  id: string;
  policyId: string;
  agentId: string;
  overrideType: OverrideType;
  maxRequests?: number;
  windowSeconds?: number;
  reason?: string;
  expiresAt?: string;
  grantedBy?: string;
}

export const RESOURCE_TYPES: ResourceType[] = ['api', 'task', 'skill', 'model', 'storage', 'network'];
export const THROTTLE_STRATEGIES: ThrottleStrategy[] = ['sliding_window', 'fixed_window', 'token_bucket', 'leaky_bucket'];
export const OVERRIDE_TYPES: OverrideType[] = ['increase', 'decrease', 'exempt', 'temporary'];
export const THROTTLE_EVENT_TYPES: ThrottleEventType[] = ['throttled', 'blocked', 'warned', 'burst_exceeded', 'quota_reset'];

export function isWithinLimit(counter: RateLimitCounter, policy: RateLimitPolicy): boolean {
  return counter.requestCount < policy.maxRequests;
}

export function getQuotaUsagePercent(allocation: QuotaAllocation): number {
  if (allocation.allocated === 0) return 0;
  return Math.round((allocation.consumed / allocation.allocated) * 100);
}

export function isOverrideActive(override: RateLimitOverride): boolean {
  if (!override.expiresAt) return true;
  return new Date(override.expiresAt) > new Date();
}

export function calculateRetryAfter(counter: RateLimitCounter): number {
  const windowEnd = new Date(counter.windowEnd).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((windowEnd - now) / 1000));
}
