export type PipelineType = 'ci' | 'cd' | 'ci_cd' | 'custom';
export type PipelineTrigger = 'push' | 'merge_request' | 'tag' | 'schedule' | 'manual' | 'api';
export type PipelineState = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'skipped';

export interface AgentPipelineConfig {
  id: string; agent_id: string; pipeline_type: PipelineType; source_repo: string;
  trigger_events: PipelineTrigger[]; timeout_minutes: number;
  max_concurrent: number; status: string; created_at: string; updated_at: string;
}
export interface AgentPipelineRun {
  id: string; config_id: string; run_number: number; trigger: PipelineTrigger;
  commit_sha: string; branch: string; state: PipelineState;
  stages: unknown[]; duration_seconds: number;
  started_at: string; completed_at: string; created_at: string;
}
export interface AgentPipelineStage {
  id: string; run_id: string; stage_name: string; stage_index: number;
  state: PipelineState; logs: string; duration_seconds: number;
  started_at: string; completed_at: string;
}
