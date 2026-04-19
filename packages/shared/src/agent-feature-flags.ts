export type AgentFeatureFlagKind = 'boolean' | 'percentage' | 'variant' | 'schedule';
export type FlagConditionType = 'agent_id' | 'archetype' | 'tag' | 'percentage' | 'schedule' | 'always';

export interface AgentFeatureFlag {
  id: string;
  agentId: string | null;
  flagKey: string;
  flagKind: AgentFeatureFlagKind;
  enabled: boolean;
  description: string | null;
  defaultValue: unknown;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentFeatureFlagRule {
  id: string;
  flagId: string;
  priority: number;
  conditionType: FlagConditionType;
  conditionValue: Record<string, unknown>;
  serveValue: unknown;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentFeatureFlagEval {
  id: string;
  flagId: string;
  agentId: string;
  ruleId: string | null;
  evaluatedValue: unknown;
  context: Record<string, unknown>;
  createdAt: string;
}

export interface AgentFeatureFlagStats {
  totalFlags: number;
  enabledFlags: number;
  totalRules: number;
  totalEvaluations: number;
  trueRate: number;
  falseRate: number;
}
