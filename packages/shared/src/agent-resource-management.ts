// ---------------------------------------------------------------------------
// Batch 54 — Agent Resource Management  (shared types)
// ---------------------------------------------------------------------------

/* ── type unions ── */

export type ResourceType = 'compute' | 'memory' | 'storage' | 'network' | 'gpu';
export type ResourcePoolStatus = 'active' | 'degraded' | 'offline' | 'maintenance' | 'draining';
export type AllocationStatus = 'pending' | 'allocated' | 'active' | 'releasing' | 'released' | 'failed';
export type QuotaPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'unlimited';
export type ResourceOperation = 'allocate' | 'consume' | 'release' | 'reclaim' | 'scale_up' | 'scale_down';
export type ScalingMetric = 'utilization' | 'queue_depth' | 'latency' | 'error_rate' | 'cost';
export type ResourceAction = 'pool_create' | 'pool_resize' | 'allocation_request' | 'allocation_release' | 'quota_set' | 'scaling_rule_add' | 'usage_report';

/* ── interfaces ── */

export interface ResourcePool {
  id: string;
  poolName: string;
  resourceType: ResourceType;
  totalCapacity: number;
  allocated: number;
  available: number;
  unit: string;
  region: string;
  status: ResourcePoolStatus;
  metadata: Record<string, unknown>;
}

export interface ResourceAllocation {
  id: string;
  agentId: string;
  poolId: string;
  resourceType: ResourceType;
  amount: number;
  priority: number;
  status: AllocationStatus;
  requestedAt: string;
  allocatedAt?: string;
  releasedAt?: string;
  expiresAt?: string;
}

export interface ResourceQuota {
  id: string;
  agentId: string;
  resourceType: ResourceType;
  maxAmount: number;
  currentUsage: number;
  softLimit?: number;
  hardLimit: number;
  period: QuotaPeriod;
  resetAt?: string;
}

export interface ResourceUsageLog {
  id: string;
  agentId: string;
  allocationId?: string;
  resourceType: ResourceType;
  amountUsed: number;
  costTokens: number;
  operation: ResourceOperation;
  recordedAt: string;
}

export interface ResourceScalingRule {
  id: string;
  poolId: string;
  ruleName: string;
  metric: ScalingMetric;
  thresholdUp: number;
  thresholdDown: number;
  scaleAmount: number;
  cooldownSecs: number;
  enabled: boolean;
  lastTriggered?: string;
}

/* ── constants ── */

export const RESOURCE_TYPES: readonly ResourceType[] = ['compute', 'memory', 'storage', 'network', 'gpu'];
export const RESOURCE_POOL_STATUSES: readonly ResourcePoolStatus[] = ['active', 'degraded', 'offline', 'maintenance', 'draining'];
export const ALLOCATION_STATUSES: readonly AllocationStatus[] = ['pending', 'allocated', 'active', 'releasing', 'released', 'failed'];
export const QUOTA_PERIODS: readonly QuotaPeriod[] = ['hourly', 'daily', 'weekly', 'monthly', 'unlimited'];
export const RESOURCE_OPERATIONS: readonly ResourceOperation[] = ['allocate', 'consume', 'release', 'reclaim', 'scale_up', 'scale_down'];
export const SCALING_METRICS: readonly ScalingMetric[] = ['utilization', 'queue_depth', 'latency', 'error_rate', 'cost'];

/* ── helpers ── */

export function isPoolAvailable(status: ResourcePoolStatus): boolean {
  return status === 'active' || status === 'degraded';
}

export function isAllocationActive(status: AllocationStatus): boolean {
  return status === 'allocated' || status === 'active';
}

export function isQuotaExceeded(quota: ResourceQuota): boolean {
  return quota.currentUsage >= quota.hardLimit;
}

export function calculateUtilization(pool: ResourcePool): number {
  if (pool.totalCapacity === 0) return 0;
  return Math.round((pool.allocated / pool.totalCapacity) * 10000) / 100;
}
