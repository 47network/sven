export type FlagType = 'boolean' | 'percentage' | 'variant' | 'user_list';
export type EvaluationReason = 'default' | 'targeting_match' | 'percentage_rollout' | 'variant_assigned' | 'disabled' | 'error';

export interface FeatureFlagEngineConfig {
  id: string;
  agentId: string;
  defaultEnabled: boolean;
  cacheTtlSeconds: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlag {
  id: string;
  configId: string;
  flagKey: string;
  name: string;
  description?: string;
  flagType: FlagType;
  enabled: boolean;
  rolloutPercentage: number;
  variants?: Record<string, unknown>;
  targetingRules: Record<string, unknown>[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlagEvaluation {
  id: string;
  flagId: string;
  subjectId: string;
  result: Record<string, unknown>;
  reason: EvaluationReason;
  evaluatedAt: Date;
}
