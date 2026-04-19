// Agent Patch Management — system and dependency patch lifecycle types

export type PatchAdvisorySource = 'cve' | 'npm' | 'github' | 'os_vendor' | 'internal' | 'custom';
export type PatchSeverity = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type PatchDeploymentStatus = 'pending' | 'testing' | 'approved' | 'deploying' | 'deployed' | 'failed' | 'rolled_back';
export type PatchComplianceLevel = 'compliant' | 'partial' | 'non_compliant' | 'exempt';

export interface PatchAdvisory {
  id: string;
  advisoryId: string;
  source: PatchAdvisorySource;
  severity: PatchSeverity;
  title: string;
  description?: string;
  affectedComponent?: string;
  affectedVersions?: string;
  fixedVersion?: string;
  patchUrl?: string;
  publishedAt?: string;
  metadata: Record<string, unknown>;
}

export interface PatchDeployment {
  id: string;
  advisoryId?: string;
  targetSystem: string;
  targetVersionBefore?: string;
  targetVersionAfter?: string;
  status: PatchDeploymentStatus;
  deployedBy?: string;
  testedAt?: string;
  deployedAt?: string;
  rollbackAt?: string;
  notes?: string;
  metadata: Record<string, unknown>;
}

export interface PatchCompliance {
  id: string;
  systemName: string;
  totalAdvisories: number;
  patchedCount: number;
  pendingCount: number;
  complianceScore: number;
  lastScanAt?: string;
  nextScanAt?: string;
  exceptions: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
}
