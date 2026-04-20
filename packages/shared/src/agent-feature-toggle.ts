// Batch 356: Feature Toggle types

export type RolloutStrategy = 'percentage' | 'user_list' | 'gradual' | 'ring' | 'canary';
export type FlagType = 'boolean' | 'string' | 'number' | 'json';
export type FlagStatus = 'active' | 'inactive' | 'archived';
export type ToggleAction = 'enable' | 'disable' | 'update_rules' | 'archive';

export interface FeatureToggleConfig {
  id: string;
  agentId: string;
  name: string;
  rolloutStrategy: RolloutStrategy;
  defaultState: boolean;
  evaluationOrder: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlag {
  id: string;
  configId: string;
  flagKey: string;
  flagName: string;
  description?: string;
  flagType: FlagType;
  defaultValue: unknown;
  currentValue?: unknown;
  rolloutPercentage: number;
  targetRules: unknown[];
  status: FlagStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FlagEvaluation {
  id: string;
  flagId: string;
  context: Record<string, unknown>;
  evaluatedValue: unknown;
  ruleMatched?: string;
  evaluationDurationMs?: number;
  createdAt: string;
}
