export type AuditSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type AuditAlertStatus = 'pending' | 'acknowledged' | 'dismissed';

export interface AgentAuditLog {
  id: string;
  agentId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  severity: AuditSeverity;
  details: Record<string, unknown>;
  sourceIp?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AgentAuditPolicy {
  id: string;
  agentId: string;
  policyName: string;
  resourceTypes: string[];
  actions: string[];
  retentionDays: number;
  alertOn: string[];
  enabled: boolean;
  createdAt: string;
}

export interface AgentAuditAlert {
  id: string;
  policyId: string;
  logId: string;
  alertType: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
