// Agent Forensic Analysis — post-incident investigation and evidence collection types

export type ForensicCaseSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';
export type ForensicCaseStatus = 'open' | 'investigating' | 'evidence_collection' | 'analysis' | 'concluded' | 'archived';
export type ForensicEvidenceType = 'log' | 'metric' | 'trace' | 'screenshot' | 'config_snapshot' | 'memory_dump' | 'network_capture' | 'timeline';
export type ForensicImpactLevel = 'none' | 'minor' | 'moderate' | 'major' | 'catastrophic';

export interface ForensicCase {
  id: string;
  caseNumber: string;
  incidentId?: string;
  severity: ForensicCaseSeverity;
  status: ForensicCaseStatus;
  title: string;
  description?: string;
  leadInvestigatorId?: string;
  findings?: string;
  rootCause?: string;
  metadata: Record<string, unknown>;
  openedAt: string;
  closedAt?: string;
}

export interface ForensicEvidence {
  id: string;
  caseId: string;
  evidenceType: ForensicEvidenceType;
  sourceSystem?: string;
  content?: string;
  contentHash?: string;
  collectedAt: string;
  collectedBy?: string;
  chainOfCustody: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
}

export interface ForensicTimeline {
  id: string;
  caseId: string;
  eventTime: string;
  eventType: string;
  description: string;
  source?: string;
  impactLevel?: ForensicImpactLevel;
  evidenceIds: string[];
  metadata: Record<string, unknown>;
}
