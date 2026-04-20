export type AlertSeverity = 'info' | 'warning' | 'critical' | 'fatal';
export type IncidentState = 'firing' | 'acknowledged' | 'resolved' | 'silenced';

export interface AgentAlertMgrConfig {
  id: string; agent_id: string; default_channel: string; dedup_interval_minutes: number;
  grouping_rules: Record<string, unknown>; status: string; created_at: string; updated_at: string;
}
export interface AgentAlertRule {
  id: string; config_id: string; rule_name: string; condition: Record<string, unknown>;
  severity: AlertSeverity; channels: string[]; cooldown_minutes: number; active: boolean; created_at: string;
}
export interface AgentAlertIncident {
  id: string; rule_id: string; state: IncidentState; message: string;
  labels: Record<string, string>; fired_at: string; resolved_at: string | null; acknowledged_by: string | null;
}
