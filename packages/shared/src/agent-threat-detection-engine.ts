export type SensitivityLevel = 'low' | 'medium' | 'high' | 'critical';
export type ThreatSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type ResponseAction = 'alert' | 'block' | 'quarantine' | 'log';
export type ThreatEventStatus = 'open' | 'investigating' | 'mitigated' | 'resolved' | 'false_positive';

export interface ThreatDetectionEngineConfig {
  id: string;
  agentId: string;
  sensitivityLevel: SensitivityLevel;
  autoBlock: boolean;
  alertChannels: string[];
  scanIntervalSeconds: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThreatRule {
  id: string;
  configId: string;
  name: string;
  pattern: string;
  severity: ThreatSeverity;
  category: string;
  responseAction: ResponseAction;
  enabled: boolean;
  createdAt: Date;
}

export interface ThreatEvent {
  id: string;
  configId: string;
  ruleId?: string;
  severity: ThreatSeverity;
  source: string;
  description: string;
  evidence: Record<string, unknown>;
  status: ThreatEventStatus;
  resolvedAt?: Date;
  createdAt: Date;
}
