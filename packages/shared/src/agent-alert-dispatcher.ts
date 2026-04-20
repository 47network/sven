export type AlertChannelType = 'email' | 'slack' | 'webhook' | 'pagerduty' | 'discord' | 'sms' | 'teams';
export type AlertChannelStatus = 'active' | 'disabled' | 'rate_limited' | 'error' | 'testing';
export type AlertRuleSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertRuleStatus = 'active' | 'disabled' | 'muted' | 'testing' | 'expired';
export type AlertIncidentStatus = 'firing' | 'acknowledged' | 'resolved' | 'escalated' | 'suppressed';

export interface AlertChannel {
  id: string;
  agent_id: string;
  channel_name: string;
  channel_type: AlertChannelType;
  status: AlertChannelStatus;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AlertRule {
  id: string;
  agent_id: string;
  rule_name: string;
  severity: AlertRuleSeverity;
  condition: Record<string, unknown>;
  channels: string[];
  status: AlertRuleStatus;
  cooldown_seconds: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AlertIncident {
  id: string;
  rule_id: string;
  status: AlertIncidentStatus;
  severity: string;
  summary: string;
  details: Record<string, unknown>;
  fired_at: string;
  resolved_at?: string;
  metadata: Record<string, unknown>;
}
