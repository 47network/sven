/* Batch 166 — Agent Compliance Report */

export type AgentComplianceFrameworkType = 'gdpr' | 'soc2' | 'iso27001' | 'hipaa' | 'pci_dss' | 'nist' | 'custom';

export type AgentComplianceFrameworkStatus = 'active' | 'draft' | 'archived';

export type AgentComplianceAssessmentStatus = 'in_progress' | 'completed' | 'reviewed' | 'accepted';

export type AgentComplianceFindingType = 'pass' | 'fail' | 'warning' | 'not_applicable' | 'exception';

export type AgentComplianceFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AgentComplianceFramework {
  id: string;
  tenantId: string;
  frameworkName: string;
  frameworkType: AgentComplianceFrameworkType;
  version: string;
  controls: unknown[];
  status: AgentComplianceFrameworkStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentComplianceAssessment {
  id: string;
  frameworkId: string;
  assessmentName: string;
  assessor: string;
  overallScore: number;
  passCount: number;
  failCount: number;
  naCount: number;
  findings: unknown[];
  evidenceUrls: string[];
  status: AgentComplianceAssessmentStatus;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentComplianceFinding {
  id: string;
  assessmentId: string;
  controlId: string;
  findingType: AgentComplianceFindingType;
  severity: AgentComplianceFindingSeverity;
  description: string;
  remediation: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentComplianceReportStats {
  totalFrameworks: number;
  totalAssessments: number;
  avgScore: number;
  openFindings: number;
  criticalFindings: number;
}
