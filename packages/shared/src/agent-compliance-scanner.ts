// Batch 110 — Agent Compliance Scanner types

export type ComplianceFramework = 'soc2' | 'gdpr' | 'hipaa' | 'pci_dss' | 'iso27001' | 'nist' | 'custom';
export type ComplianceSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ComplianceScanResultStatus = 'compliant' | 'non_compliant' | 'exempted' | 'not_applicable';
export type ComplianceRemediationStatus = 'pending' | 'in_progress' | 'completed' | 'deferred' | 'wont_fix';

export interface CompliancePolicy {
  id: string;
  agentId: string;
  policyName: string;
  framework: ComplianceFramework;
  category: string;
  severity: ComplianceSeverity;
  ruleExpression: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceScanResult {
  id: string;
  agentId: string;
  policyId: string;
  resourceType: string;
  resourceId: string;
  status: ComplianceScanResultStatus;
  evidence: Record<string, unknown> | null;
  scannedAt: string;
  resolvedAt: string | null;
  createdAt: string;
}

export interface ComplianceRemediation {
  id: string;
  agentId: string;
  scanResultId: string;
  actionType: string;
  description: string;
  status: ComplianceRemediationStatus;
  assignedTo: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceScannerStats {
  totalPolicies: number;
  enabledPolicies: number;
  totalScans: number;
  compliantCount: number;
  nonCompliantCount: number;
  remediationsPending: number;
}
