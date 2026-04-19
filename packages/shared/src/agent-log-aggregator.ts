export type LogSourceType = 'application' | 'system' | 'container' | 'network' | 'security' | 'audit';
export type LogSourceStatus = 'active' | 'paused' | 'disabled' | 'error' | 'draining';
export type LogFormat = 'json' | 'syslog' | 'clf' | 'csv' | 'plaintext' | 'logfmt';
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogPipelineStatus = 'active' | 'paused' | 'disabled' | 'error' | 'building';

export interface LogSource {
  id: string;
  agent_id: string;
  source_name: string;
  source_type: LogSourceType;
  status: LogSourceStatus;
  endpoint?: string;
  format: LogFormat;
  retention_days: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LogEntry {
  id: string;
  source_id: string;
  level: LogLevel;
  message: string;
  context: Record<string, unknown>;
  timestamp: string;
  ingested_at: string;
}

export interface LogPipeline {
  id: string;
  agent_id: string;
  pipeline_name: string;
  status: LogPipelineStatus;
  stages: unknown[];
  throughput_eps: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
