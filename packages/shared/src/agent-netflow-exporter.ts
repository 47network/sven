export type NetflowVersion = 5 | 9 | 10;

export interface AgentNetflowConfig { id: string; agent_id: string; exporter_name: string; source_interface: string; collector_address: string; collector_port: number; version: NetflowVersion; template_refresh_sec: number; active_timeout_sec: number; inactive_timeout_sec: number; metadata: Record<string, unknown>; created_at: string; updated_at: string; }
export interface AgentNetflowTemplate { id: string; config_id: string; template_id: number; template_name: string | null; field_count: number; fields: Record<string, unknown>[]; created_at: string; }
export interface AgentNetflowStat { id: string; config_id: string; period_start: string; flows_exported: number; packets_sent: number; template_refreshes: number; export_errors: number; created_at: string; }
