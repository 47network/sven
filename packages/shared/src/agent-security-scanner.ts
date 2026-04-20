export type ScanType = 'vulnerability' | 'dependency' | 'configuration' | 'code' | 'network' | 'container';
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RemediationType = 'patch' | 'config_change' | 'upgrade' | 'workaround' | 'accept_risk';
export type RemediationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface AgentScanProfile {
  id: string;
  agentId: string;
  profileName: string;
  scanType: ScanType;
  targets: string[];
  schedule?: string;
  severityThreshold: SeverityLevel;
  enabled: boolean;
  createdAt: Date;
}

export interface AgentScanResult {
  id: string;
  profileId: string;
  agentId: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: Record<string, unknown>[];
  durationMs?: number;
  scannedAt: Date;
}

export interface AgentScanRemediation {
  id: string;
  resultId: string;
  findingIndex: number;
  remediationType: RemediationType;
  description: string;
  status: RemediationStatus;
  appliedAt?: Date;
  createdAt: Date;
}
