export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertChannel = 'email' | 'slack' | 'webhook' | 'sms' | 'nats' | 'pagerduty';

export interface AlertRouterConfig {
  id: string;
  agentId: string;
  defaultChannel: AlertChannel;
  escalationPolicy: Record<string, unknown>;
  suppressionRules: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
}

export interface AlertRule {
  id: string;
  configId: string;
  name: string;
  condition: Record<string, unknown>;
  severity: AlertSeverity;
  channels: AlertChannel[];
  cooldownSeconds: number;
  enabled: boolean;
  createdAt: string;
}

export interface AlertHistory {
  id: string;
  ruleId: string;
  severity: AlertSeverity;
  channel: AlertChannel;
  payload: Record<string, unknown>;
  delivered: boolean;
  deliveredAt: string | null;
  createdAt: string;
}
