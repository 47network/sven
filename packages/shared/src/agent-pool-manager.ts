export type PoolMode = 'session' | 'transaction' | 'statement';
export type ConnectionState = 'idle' | 'active' | 'waiting' | 'draining' | 'closed';

export interface AgentPoolMgrConfig {
  id: string; agent_id: string; pool_mode: PoolMode; min_connections: number;
  max_connections: number; idle_timeout_seconds: number; max_lifetime_seconds: number;
  status: string; created_at: string; updated_at: string;
}
export interface AgentPoolConnection {
  id: string; config_id: string; client_addr: string; server_addr: string;
  database_name: string; state: ConnectionState; queries_executed: number;
  connected_at: string; last_activity_at: string;
}
export interface AgentPoolStats {
  id: string; config_id: string; active_connections: number; idle_connections: number;
  waiting_clients: number; total_queries: number; avg_query_ms: number; recorded_at: string;
}
