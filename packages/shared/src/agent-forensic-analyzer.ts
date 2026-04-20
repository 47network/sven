export type CaseType = 'incident' | 'breach' | 'malware' | 'insider' | 'compliance';
export type CaseStatus = 'open' | 'investigating' | 'analysis' | 'reporting' | 'closed';
export type EvidenceType = 'log' | 'memory_dump' | 'disk_image' | 'network_capture' | 'file' | 'screenshot';

export interface AgentForensicAnalyzerConfig {
  id: string;
  agentId: string;
  name: string;
  evidenceRetentionDays: number;
  chainOfCustody: boolean;
  autoSnapshot: boolean;
  hashAlgorithm: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentForensicCase {
  id: string;
  configId: string;
  caseName: string;
  caseType: CaseType;
  status: CaseStatus;
  severity: string;
  leadInvestigator?: string;
  summary?: string;
  timeline: unknown[];
  findings: unknown[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  closedAt?: Date;
}

export interface AgentForensicEvidence {
  id: string;
  caseId: string;
  evidenceType: EvidenceType;
  source: string;
  hashValue?: string;
  fileSize?: number;
  contentPreview?: string;
  chainLog: unknown[];
  tags: string[];
  metadata: Record<string, unknown>;
  collectedAt: Date;
}
