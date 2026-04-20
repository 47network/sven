export interface StackAuditorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  auditScope: string[];
  schedule: string;
  severityThreshold: string;
  autoFix: boolean;
  exclusions: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AuditFinding {
  id: string;
  configId: string;
  category: string;
  severity: string;
  packageName: string;
  currentVersion: string;
  fixedVersion: string | null;
  description: string;
  detectedAt: string;
}

export interface AuditReport {
  id: string;
  configId: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  autoFixed: number;
  generatedAt: string;
}
