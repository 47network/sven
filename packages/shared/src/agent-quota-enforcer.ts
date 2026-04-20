// Batch 351: Quota Enforcer types
export type QuotaPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';
export type EnforcementMode = 'soft' | 'hard' | 'advisory' | 'graduated';
export type OveragePolicy = 'block' | 'throttle' | 'charge' | 'alert_only' | 'degrade';
export type ViolationType = 'limit_exceeded' | 'rate_exceeded' | 'burst_exceeded' | 'policy_violation';

export interface QuotaEnforcerConfig {
  id: string;
  agentId: string;
  resourceType: string;
  quotaLimit: number;
  quotaPeriod: QuotaPeriod;
  enforcementMode: EnforcementMode;
  warningThreshold: number;
  overagePolicy: OveragePolicy;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuotaUsage {
  id: string;
  configId: string;
  currentUsage: number;
  periodStart: Date;
  periodEnd: Date;
  peakUsage: number;
  lastResetAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuotaViolation {
  id: string;
  configId: string;
  violationType: ViolationType;
  usageAtViolation: number;
  quotaAtViolation: number;
  actionTaken?: string;
  resolved: boolean;
  createdAt: Date;
}
