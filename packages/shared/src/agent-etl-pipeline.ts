export type EtlFramework = 'spark' | 'flink' | 'airflow' | 'dagster' | 'dbt';
export type EtlJobStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface AgentEtlConfig {
  id: string; agent_id: string; framework: EtlFramework; schedule_cron: string;
  max_retries: number; timeout_minutes: number; metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export interface AgentEtlJob {
  id: string; config_id: string; job_name: string; source_type: string;
  destination_type: string; transform_logic: Record<string, unknown>;
  status: EtlJobStatus; last_run_at?: string; created_at: string;
}

export interface AgentEtlRun {
  id: string; job_id: string; rows_extracted: number; rows_transformed: number;
  rows_loaded: number; duration_ms?: number; error_message?: string;
  started_at: string; completed_at?: string;
}
