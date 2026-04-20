export type FlagType = 'boolean' | 'string' | 'number' | 'json';
export type EvaluationMode = 'server' | 'client' | 'edge';
export type RolloutStrategy = 'percentage' | 'targeting' | 'gradual' | 'kill_switch';

export interface AgentFeatureFlagConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  maxFlags: number;
  defaultRolloutPct: number;
  evaluationMode: EvaluationMode;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentFeatureFlag {
  id: string;
  configId: string;
  flagKey: string;
  description?: string;
  flagType: FlagType;
  defaultValue: unknown;
  rolloutPercentage: number;
  targetingRules: unknown[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentFlagEvaluation {
  id: string;
  flagId: string;
  context: Record<string, unknown>;
  result: unknown;
  reason?: string;
  evaluatedAt: Date;
}
