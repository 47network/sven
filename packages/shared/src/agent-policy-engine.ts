export type PolicyType = 'access' | 'data' | 'network' | 'compliance' | 'operational';
export type PolicyEnforcement = 'enforce' | 'audit' | 'disabled';
export type PolicyDecision = 'allow' | 'deny' | 'audit';
export type PolicyExceptionStatus = 'pending' | 'approved' | 'denied' | 'expired';

export interface AgentSecurityPolicy {
  id: string;
  agentId: string;
  policyName: string;
  policyType: PolicyType;
  rules: Record<string, unknown>[];
  priority: number;
  enforcement: PolicyEnforcement;
  scope: Record<string, unknown>;
  status: 'active' | 'inactive' | 'draft' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentPolicyEvaluation {
  id: string;
  policyId: string;
  agentId: string;
  action: string;
  decision: PolicyDecision;
  context: Record<string, unknown>;
  evaluatedAt: Date;
}

export interface AgentPolicyException {
  id: string;
  policyId: string;
  agentId: string;
  reason: string;
  approvedBy?: string;
  expiresAt?: Date;
  status: PolicyExceptionStatus;
  createdAt: Date;
}
