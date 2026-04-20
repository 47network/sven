export type BwAlertType = 'threshold_exceeded' | 'utilization_high' | 'rate_spike' | 'sustained_peak';
export type BwDirection = 'rx' | 'tx' | 'both';

export interface AgentBwConfig { id: string; agent_id: string; monitor_name: string; interface_name: string; poll_interval_sec: number; alert_threshold_mbps: number | null; retention_hours: number; metadata: Record<string, unknown>; created_at: string; updated_at: string; }
export interface AgentBwSample { id: string; config_id: string; rx_bytes: number; tx_bytes: number; rx_rate_mbps: number; tx_rate_mbps: number; utilization_pct: number; sampled_at: string; }
export interface AgentBwAlert { id: string; config_id: string; alert_type: BwAlertType; threshold_mbps: number | null; actual_mbps: number | null; direction: BwDirection; acknowledged: boolean; triggered_at: string; }
