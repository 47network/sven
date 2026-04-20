// Batch 178: Agent Quota Enforcement Types

export type QuotaResourceType = 'compute' | 'storage' | 'network' | 'api_calls' | 'tokens' | 'tasks' | 'agents' | 'bandwidth';
export type QuotaEnforcementAction = 'soft_limit' | 'hard_limit' | 'throttle' | 'queue' | 'notify' | 'block';
export type QuotaPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type QuotaUsageStatus = 'within_limit' | 'warning' | 'at_limit' | 'over_limit' | 'suspended';
export type QuotaAlertType = 'threshold_warning' | 'limit_reached' | 'overage' | 'suspension' | 'reset';

export interface QuotaPolicy {
  id: string;
  name: string;
  description: string | null;
  resourceType: QuotaResourceType;
  scope: string;
  limitValue: number;
  limitUnit: string;
  period: QuotaPeriod;
  enforcementAction: QuotaEnforcementAction;
  overageRate: number;
  priority: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface QuotaUsage {
  id: string;
  policyId: string;
  agentId: string;
  periodStart: string;
  periodEnd: string;
  currentUsage: number;
  peakUsage: number;
  overageAmount: number;
  overageCost: number;
  status: QuotaUsageStatus;
  lastCheckedAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface QuotaAlert {
  id: string;
  policyId: string;
  agentId: string;
  alertType: QuotaAlertType;
  thresholdPercent: number;
  currentPercent: number;
  message: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
