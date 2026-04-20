export type UptimeState = 'up' | 'down' | 'degraded' | 'unknown' | 'maintenance';
export type CheckMethod = 'GET' | 'POST' | 'HEAD' | 'OPTIONS';

export interface AgentUptimeConfig {
  id: string; agent_id: string; check_interval_seconds: number; timeout_ms: number;
  expected_status: number; alert_after_failures: number; status: string; created_at: string; updated_at: string;
}
export interface AgentUptimeEndpoint {
  id: string; config_id: string; url: string; method: CheckMethod;
  headers: Record<string, string>; current_state: UptimeState;
  last_checked_at: string | null; last_up_at: string | null; last_down_at: string | null; created_at: string;
}
export interface AgentUptimeCheck {
  id: string; endpoint_id: string; status_code: number; response_ms: number;
  healthy: boolean; error: string | null; checked_at: string;
}
