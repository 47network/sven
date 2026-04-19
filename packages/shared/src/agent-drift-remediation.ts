// Batch 174: Agent Drift Remediation types

export type DriftResourceType = 'config' | 'schema' | 'infrastructure' | 'dependency' | 'environment' | 'security_policy' | 'access_control' | 'network_rule';
export type DriftDetectionType = 'addition' | 'deletion' | 'modification' | 'permission_change' | 'version_mismatch' | 'structural';
export type DriftSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DriftStatus = 'detected' | 'investigating' | 'remediating' | 'remediated' | 'accepted' | 'escalated' | 'failed';
export type DriftActionType = 'auto_fix' | 'manual_fix' | 'rollback' | 'approve_drift' | 'escalate' | 'suppress';
export type DriftActionOutcome = 'success' | 'failure' | 'partial' | 'pending';

export interface DriftBaseline {
  id: string;
  agentId: string;
  resourceType: DriftResourceType;
  resourcePath: string;
  desiredState: Record<string, unknown>;
  currentState: Record<string, unknown> | null;
  checksum: string;
  autoRemediate: boolean;
  lastVerifiedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DriftDetection {
  id: string;
  baselineId: string;
  driftType: DriftDetectionType;
  severity: DriftSeverity;
  diffSummary: string;
  diffDetail: Record<string, unknown>;
  status: DriftStatus;
  remediationPlan: string | null;
  remediatedBy: string | null;
  detectedAt: string;
  remediatedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface DriftRemediationLog {
  id: string;
  detectionId: string;
  actionType: DriftActionType;
  actionDetail: Record<string, unknown>;
  outcome: DriftActionOutcome;
  executedBy: string;
  executedAt: string;
  notes: string | null;
}
