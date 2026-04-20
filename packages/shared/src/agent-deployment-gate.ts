export type GateCheckType = 'unit_tests' | 'integration_tests' | 'security_scan' | 'performance_check' | 'manual_approval' | 'policy_check';
export type GateDecision = 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'overridden';
export type DecisionAuthority = 'system' | 'agent' | 'admin' | 'timeout';

export interface AgentDeploymentGateConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  requireAllChecks: boolean;
  autoApproveTimeout: number;
  notificationChannel: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentGateCheck {
  id: string;
  configId: string;
  checkName: string;
  checkType: GateCheckType;
  required: boolean;
  parameters: Record<string, unknown>;
  createdAt: Date;
}

export interface AgentGateDecision {
  id: string;
  configId: string;
  deploymentId: string;
  checkResults: unknown[];
  decision: GateDecision;
  decidedBy?: string;
  reason?: string;
  decidedAt?: Date;
}
