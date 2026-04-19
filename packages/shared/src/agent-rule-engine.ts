export type EvaluationMode = 'sequential' | 'parallel' | 'priority' | 'first_match' | 'all_match';
export type ConflictResolution = 'priority' | 'first_wins' | 'last_wins' | 'merge' | 'error';
export type RuleStatus = 'active' | 'inactive' | 'draft' | 'testing' | 'deprecated';
export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'matches';

export interface RuleEngineConfig {
  id: string;
  agentId: string;
  evaluationMode: EvaluationMode;
  conflictResolution: ConflictResolution;
  maxRulesPerSet: number;
  cachingEnabled: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleSet {
  id: string;
  configId: string;
  agentId: string;
  ruleSetName: string;
  description?: string;
  priority: number;
  ruleCount: number;
  active: boolean;
  version: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentRule {
  id: string;
  ruleSetId: string;
  ruleName: string;
  conditionExpression: Record<string, unknown>;
  actionExpression: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  hitCount: number;
  lastTriggeredAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
