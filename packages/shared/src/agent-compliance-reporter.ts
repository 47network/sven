export type ComplianceFramework = 'soc2' | 'gdpr' | 'hipaa' | 'pci_dss' | 'iso27001' | 'nist';
export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'on_demand';
export type ReportStatus = 'generating' | 'completed' | 'failed' | 'reviewed' | 'published';
export type EvidenceStatus = 'collected' | 'verified' | 'insufficient' | 'expired';

export interface ComplianceReporterConfig {
  id: string;
  agentId: string;
  frameworks: ComplianceFramework[];
  reportFrequency: ReportFrequency;
  autoEvidenceCollection: boolean;
  notificationRecipients: string[];
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceReport {
  id: string;
  configId: string;
  agentId: string;
  framework: ComplianceFramework;
  reportType: string;
  periodStart: Date;
  periodEnd: Date;
  overallScore: number | null;
  totalControls: number;
  passingControls: number;
  failingControls: number;
  status: ReportStatus;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ComplianceEvidence {
  id: string;
  reportId: string;
  controlId: string;
  controlName: string;
  evidenceType: string;
  evidenceData: Record<string, unknown>;
  status: EvidenceStatus;
  verifiedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
