/* Batch 128 — Agent Feature Flags */

export type FeatureFlagType = 'boolean' | 'percentage' | 'variant' | 'schedule';

export type FlagChangeType = 'created' | 'toggled' | 'rollout_changed' | 'variant_added' | 'archived';

export interface ManagedFeatureFlag {
  id: string;
  agentId: string;
  flagKey: string;
  flagType: FeatureFlagType;
  enabled: boolean;
  rolloutPct: number;
  variants: unknown[];
  targetingRules: Record<string, unknown>;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedFlagEvaluation {
  id: string;
  flagId: string;
  contextKey: string;
  result: unknown;
  variantServed?: string;
  evaluatedAt: string;
}

export interface FlagAuditEntry {
  id: string;
  flagId: string;
  changeType: FlagChangeType;
  oldValue?: unknown;
  newValue?: unknown;
  changedBy?: string;
  changedAt: string;
}

export interface FeatureFlagStats {
  totalFlags: number;
  enabledFlags: number;
  evaluationsToday: number;
  avgRolloutPct: number;
}
