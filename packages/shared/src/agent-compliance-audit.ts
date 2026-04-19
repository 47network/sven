export type ComplianceFrameworkType = 'gdpr' | 'soc2' | 'hipaa' | 'pci_dss' | 'iso27001' | 'custom';
export type ControlStatus = 'not_assessed' | 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
export type AuditReportType = 'full' | 'delta' | 'control' | 'executive';
export type ControlSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AuditComplianceFramework {
  id: string;
  agentId: string;
  name: string;
  frameworkType: ComplianceFrameworkType;
  version: string;
  controlCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceControl {
  id: string;
  frameworkId: string;
  controlId: string;
  title: string;
  description: string | null;
  category: string;
  severity: ControlSeverity;
  status: ControlStatus;
  evidence: Record<string, unknown>[];
  lastAssessedAt: string | null;
  nextReviewAt: string | null;
  createdAt: string;
}

export interface AuditReport {
  id: string;
  frameworkId: string;
  auditorAgentId: string | null;
  reportType: AuditReportType;
  complianceScore: number | null;
  findingsCount: number;
  criticalFindings: number;
  summary: string | null;
  reportData: Record<string, unknown>;
  createdAt: string;
}

export interface ComplianceAuditStats {
  totalFrameworks: number;
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  avgComplianceScore: number;
}
