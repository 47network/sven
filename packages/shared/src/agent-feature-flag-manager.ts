export type FlagStrategy = 'boolean' | 'percentage' | 'user_list' | 'gradual' | 'schedule';

export interface FeatureFlagManagerConfig {
  id: string;
  agentId: string;
  defaultStrategy: FlagStrategy;
  staleFlagDays: number;
  auditEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlag {
  id: string;
  configId: string;
  flagKey: string;
  description?: string;
  enabled: boolean;
  strategy: FlagStrategy;
  rolloutPercentage: number;
  targetingRules: Record<string, unknown>;
  createdAt: string;
}

export interface FlagEvaluation {
  id: string;
  flagId: string;
  context: Record<string, unknown>;
  result: boolean;
  reason?: string;
  evaluatedAt: string;
}
