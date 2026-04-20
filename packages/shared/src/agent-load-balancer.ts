export type LbAlgorithm = 'round_robin' | 'least_connections' | 'ip_hash' | 'weighted' | 'random' | 'least_response_time';
export type LbBackendStatus = 'healthy' | 'unhealthy' | 'draining' | 'disabled';
export type LbConfigStatus = 'active' | 'inactive' | 'maintenance' | 'failed';

export interface AgentLbConfig {
  id: string;
  agent_id: string;
  lb_name: string;
  algorithm: LbAlgorithm;
  health_check_interval_ms: number;
  sticky_sessions: boolean;
  status: LbConfigStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentLbBackend {
  id: string;
  config_id: string;
  backend_host: string;
  backend_port: number;
  weight: number;
  max_connections: number | null;
  status: LbBackendStatus;
  last_health_check: string | null;
  created_at: string;
}

export interface AgentLbMetric {
  id: string;
  config_id: string;
  requests_total: number;
  active_connections: number;
  avg_response_ms: number;
  error_rate: number;
  recorded_at: string;
}
