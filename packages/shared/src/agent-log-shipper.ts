export type LogDestination = 'opensearch' | 'elasticsearch' | 'loki' | 's3' | 'file' | 'stdout';
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface AgentLogShipConfig {
  id: string; agent_id: string; destination: LogDestination; log_level: LogLevel;
  buffer_size: number; flush_interval_seconds: number; status: string; created_at: string; updated_at: string;
}
export interface AgentLogPipeline {
  id: string; config_id: string; pipeline_name: string; source: string;
  filters: unknown[]; transforms: unknown[]; state: string; throughput_eps: number; created_at: string;
}
export interface AgentLogDestination {
  id: string; config_id: string; dest_type: LogDestination; connection_url: string;
  index_pattern: string; healthy: boolean; last_checked_at: string;
}
