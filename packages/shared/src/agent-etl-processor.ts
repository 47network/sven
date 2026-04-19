// Batch 205: ETL Processor — extract-transform-load pipeline management

export type EtlPipelineStatus = 'draft' | 'active' | 'paused' | 'error' | 'completed' | 'archived';
export type EtlRunStatus = 'pending' | 'extracting' | 'transforming' | 'loading' | 'completed' | 'failed' | 'cancelled';

export interface EtlPipeline {
  id: string;
  agent_id: string;
  name: string;
  description?: string;
  schedule_cron?: string;
  status: EtlPipelineStatus;
  source_config: Record<string, unknown>;
  transform_config: Record<string, unknown>;
  sink_config: Record<string, unknown>;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EtlRun {
  id: string;
  pipeline_id: string;
  status: EtlRunStatus;
  records_extracted: number;
  records_transformed: number;
  records_loaded: number;
  records_failed: number;
  error_log: unknown[];
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
}

export interface EtlSchedule {
  id: string;
  pipeline_id: string;
  cron_expression: string;
  timezone: string;
  enabled: boolean;
  last_triggered_at?: string;
  next_trigger_at?: string;
  retry_on_failure: boolean;
  max_retries: number;
  created_at: string;
}

export type EtlProcessorEvent =
  | 'etl.pipeline_created'
  | 'etl.run_started'
  | 'etl.run_completed'
  | 'etl.run_failed';
