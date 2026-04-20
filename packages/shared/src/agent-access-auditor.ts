/** Batch 233 — Access Auditor types */

export type AccessAction = 'read' | 'write' | 'delete' | 'execute' | 'admin' | 'export';
export type AccessOutcome = 'allowed' | 'denied' | 'escalated' | 'flagged';
export type AccessPatternType = 'normal' | 'anomalous' | 'suspicious' | 'malicious';
export type AccessAlertType = 'unusual_access' | 'privilege_escalation' | 'brute_force' | 'data_exfiltration' | 'off_hours';

export interface AgentAccessLog {
  id: string;
  agentId: string;
  resourceType: string;
  resourceId: string;
  action: AccessAction;
  outcome: AccessOutcome;
  sourceIp?: string;
  userAgent?: string;
  context: Record<string, unknown>;
  loggedAt: string;
}

export interface AgentAccessPattern {
  id: string;
  agentId: string;
  patternName: string;
  patternType: AccessPatternType;
  frequency: number;
  lastSeen: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AgentAccessAlert {
  id: string;
  agentId: string;
  patternId?: string;
  alertType: AccessAlertType;
  severity: string;
  acknowledged: boolean;
  details: Record<string, unknown>;
  createdAt: string;
}
