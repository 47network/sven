export interface QuotaManagerConfig {
  id: string;
  agentId: string;
  quotaName: string;
  resourceType: string;
  currentUsage: number;
  quotaLimit: number;
  alertThresholdPercent: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface QuotaStatus {
  quotaName: string;
  usage: number;
  limit: number;
  usagePercent: number;
  status: 'ok' | 'warning' | 'critical' | 'exceeded';
}
export interface QuotaAdjustment {
  quotaName: string;
  previousLimit: number;
  newLimit: number;
  reason: string;
  approvedBy: string;
  adjustedAt: string;
}
