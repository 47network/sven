export type RollbackTrigger = 'automatic' | 'manual' | 'health_check' | 'error_rate' | 'latency';
export type RollbackState = 'initiated' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface AgentRollbackConfig {
  id: string; agent_id: string; auto_rollback: boolean; max_rollback_depth: number;
  health_threshold: number; cooldown_minutes: number;
  status: string; created_at: string; updated_at: string;
}
export interface AgentRollbackEvent {
  id: string; config_id: string; deployment_id: string;
  from_version: string; to_version: string; reason: string;
  trigger_type: RollbackTrigger; state: RollbackState;
  duration_seconds: number; created_at: string; completed_at: string;
}
export interface AgentRollbackSnapshot {
  id: string; event_id: string; resource_type: string; resource_id: string;
  snapshot_data: Record<string, unknown>; restored: boolean; created_at: string;
}
