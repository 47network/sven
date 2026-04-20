export type ThreatRuleType = 'signature' | 'behavioral' | 'anomaly' | 'heuristic' | 'ml_model';
export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ThreatStatus = 'detected' | 'investigating' | 'confirmed' | 'mitigated' | 'false_positive';
export type ThreatResponseType = 'block' | 'alert' | 'quarantine' | 'investigate' | 'auto_remediate';

export interface AgentThreatRule {
  id: string;
  agentId: string;
  ruleName: string;
  ruleType: ThreatRuleType;
  severity: ThreatSeverity;
  pattern: Record<string, unknown>;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentThreatDetection {
  id: string;
  ruleId: string;
  threatType: string;
  severity: ThreatSeverity;
  source?: string;
  target?: string;
  evidence: Record<string, unknown>;
  status: ThreatStatus;
  detectedAt: string;
}

export interface AgentThreatResponse {
  id: string;
  detectionId: string;
  responseType: ThreatResponseType;
  executedBy?: string;
  result?: string;
  metadata: Record<string, unknown>;
  executedAt: string;
}
