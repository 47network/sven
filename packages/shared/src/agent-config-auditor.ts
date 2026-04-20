export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ConfigAuditorConfig {
  id: string;
  agentId: string;
  scanIntervalHours: number;
  complianceFrameworks: string[];
  severityThreshold: ViolationSeverity;
  metadata: Record<string, unknown>;
}

export interface ConfigSnapshot {
  id: string;
  configId: string;
  serviceName: string;
  configHash: string;
  configData: Record<string, unknown>;
  baseline: boolean;
  createdAt: string;
}

export interface ConfigViolation {
  id: string;
  snapshotId: string;
  ruleId: string;
  severity: ViolationSeverity;
  description: string;
  remediation: string | null;
  resolved: boolean;
  createdAt: string;
}
