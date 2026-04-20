// Agent Release Train — coordinated release scheduling and deployment trains types

export type ReleaseScheduleType = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'on_demand' | 'continuous';
export type ReleaseTrainStatus = 'planning' | 'boarding' | 'locked' | 'testing' | 'deploying' | 'deployed' | 'cancelled';
export type ReleaseChangeType = 'feature' | 'bugfix' | 'hotfix' | 'refactor' | 'dependency' | 'config' | 'migration';
export type ReleaseCarStatus = 'boarding' | 'ready' | 'testing' | 'approved' | 'rejected' | 'deployed';
export type ReleaseGateType = 'automated_test' | 'manual_approval' | 'security_scan' | 'performance_check' | 'compliance_review' | 'rollback_plan';
export type ReleaseGateStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'waived';
export type ReleaseRiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface ReleaseTrain {
  id: string;
  trainName: string;
  version: string;
  scheduleType: ReleaseScheduleType;
  status: ReleaseTrainStatus;
  conductorAgentId?: string;
  departureAt?: string;
  deployedAt?: string;
  targetEnvironments: string[];
  metadata: Record<string, unknown>;
}

export interface ReleaseCar {
  id: string;
  trainId: string;
  carName: string;
  component: string;
  changeType: ReleaseChangeType;
  status: ReleaseCarStatus;
  ownerAgentId?: string;
  commitRef?: string;
  testResults: Record<string, unknown>;
  riskLevel: ReleaseRiskLevel;
  notes?: string;
  metadata: Record<string, unknown>;
}

export interface ReleaseGate {
  id: string;
  trainId: string;
  gateName: string;
  gateType: ReleaseGateType;
  status: ReleaseGateStatus;
  required: boolean;
  evaluatorAgentId?: string;
  evaluationData: Record<string, unknown>;
  evaluatedAt?: string;
  metadata: Record<string, unknown>;
}
