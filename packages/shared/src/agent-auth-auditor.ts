export interface AuthAuditorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  auditScope: string[];
  complianceStandards: string[];
  auditFrequency: string;
  reportFormat: string;
  alertOnAnomaly: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface AuditFinding {
  findingId: string;
  category: string;
  severity: string;
  description: string;
  recommendation: string;
  affectedResources: string[];
}
export interface ComplianceReport {
  reportId: string;
  standard: string;
  score: number;
  passed: number;
  failed: number;
  generatedAt: string;
}
