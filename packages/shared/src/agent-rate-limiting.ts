export type RateLimitScope = 'global' | 'per_agent' | 'per_ip' | 'per_api_key' | 'per_endpoint';
export type ThrottleStrategy = 'reject' | 'queue' | 'throttle' | 'degrade';
export type RateLimitOverrideType = 'whitelist' | 'blacklist' | 'custom_limit' | 'temporary_boost';

export interface RateLimitPolicy {
  id: string;
  agentId: string;
  name: string;
  scope: RateLimitScope;
  maxRequests: number;
  windowSeconds: number;
  burstLimit: number | null;
  throttleStrategy: ThrottleStrategy;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RateLimitCounter {
  id: string;
  policyId: string;
  identifier: string;
  windowStart: string;
  requestCount: number;
  rejectedCount: number;
  lastRequestAt: string | null;
  createdAt: string;
}

export interface RateLimitOverride {
  id: string;
  policyId: string;
  identifier: string;
  overrideType: RateLimitOverrideType;
  customMaxRequests: number | null;
  customWindowSeconds: number | null;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface RateLimitingStats {
  totalPolicies: number;
  activePolicies: number;
  totalRequestsBlocked24h: number;
  topBlockedIdentifiers: string[];
  overrideCount: number;
}
