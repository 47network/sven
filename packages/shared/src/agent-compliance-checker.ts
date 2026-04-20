export type ComplianceFrameworkType = 'gdpr' | 'hipaa' | 'soc2' | 'iso27001' | 'pci_dss' | 'nist' | 'custom';
export type ComplianceFrameworkStatus = 'active' | 'inactive' | 'reviewing' | 'expired';
export type ComplianceCheckStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'not_applicable';
export type ComplianceReportType = 'summary' | 'detailed' | 'executive' | 'audit_trail';

export interface AgentComplianceFramework {
  id: string;
  agentId: string;
  frameworkName: string;
  frameworkType: ComplianceFrameworkType;
  version?: string;
  status: ComplianceFrameworkStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentComplianceCheck {
  id: string;
  frameworkId: string;
  checkName: string;
  category: string;
  status: ComplianceCheckStatus;
  evidence: Record<string, unknown>;
  findings?: string;
  checkedAt?: string;
  createdAt: string;
}

export interface AgentComplianceReport {
  id: string;
  frameworkId: string;
  reportType: ComplianceReportType;
  passRate?: number;
  totalChecks: number;
  passedChecks: number;
  findings: Record<string, unknown>;
  generatedAt: string;
}
