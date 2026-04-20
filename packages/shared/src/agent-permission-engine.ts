export type EvaluationStrategy = 'most_specific' | 'most_permissive' | 'most_restrictive' | 'priority_based';
export type PermissionEffect = 'allow' | 'deny';
export type CheckResult = 'allowed' | 'denied' | 'not_applicable';

export interface PermissionEngineConfig {
  id: string;
  agentId: string;
  evaluationStrategy: EvaluationStrategy;
  cacheTtlSeconds: number;
  wildcardEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  configId: string;
  resource: string;
  action: string;
  effect: PermissionEffect;
  conditions: Record<string, unknown>;
  priority: number;
  createdAt: string;
}

export interface PermissionCheck {
  id: string;
  configId: string;
  subject: string;
  resource: string;
  action: string;
  result: CheckResult;
  matchedPermissionId?: string;
  evaluationMs?: number;
  checkedAt: string;
}
