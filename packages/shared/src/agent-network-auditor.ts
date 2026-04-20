export type AuditScanType = 'compliance' | 'vulnerability' | 'configuration' | 'performance';
export type AuditScanStatus = 'pending' | 'running' | 'completed' | 'failed';
export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type AuditReportFormat = 'json' | 'pdf' | 'html' | 'csv';

export interface AgentAuditScan {
  id: string;
  agentId: string;
  scanName: string;
  scanType: AuditScanType;
  targetScope: string[];
  status: AuditScanStatus;
  findingsCount: number;
  criticalCount: number;
  startedAt: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentAuditFinding {
  id: string;
  scanId: string;
  severity: FindingSeverity;
  category: string;
  title: string;
  description: string | null;
  affectedResource: string | null;
  remediation: string | null;
  compliant: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentAuditReport {
  id: string;
  scanId: string;
  reportFormat: AuditReportFormat;
  summary: string | null;
  overallScore: number | null;
  storagePath: string | null;
  generatedAt: string;
  metadata: Record<string, unknown>;
}
