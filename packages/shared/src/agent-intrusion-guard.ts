export type DetectionMode = 'ids' | 'ips' | 'hybrid';
export type IntrusionSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RuleAction = 'alert' | 'block' | 'drop' | 'log' | 'quarantine';

export interface AgentIntrusionGuardConfig {
  id: string;
  agentId: string;
  name: string;
  detectionMode: DetectionMode;
  sensitivity: string;
  autoBlock: boolean;
  blockDurationMinutes: number;
  whitelist: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentIntrusionEvent {
  id: string;
  configId: string;
  eventType: string;
  sourceIp?: string;
  destinationIp?: string;
  severity: IntrusionSeverity;
  signatureId?: string;
  description?: string;
  blocked: boolean;
  rawPayload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AgentIntrusionRule {
  id: string;
  configId: string;
  ruleName: string;
  pattern: string;
  action: RuleAction;
  protocol: string;
  enabled: boolean;
  hitCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
