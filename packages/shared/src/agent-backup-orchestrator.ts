// Batch 185: Agent Backup Orchestrator — backup schedules, retention, disaster recovery

export type BackupSourceType = 'database' | 'filesystem' | 'volume' | 'snapshot' | 'application' | 'full_system';

export type BackupCompression = 'none' | 'gzip' | 'zstd' | 'lz4' | 'snappy';

export type BackupPlanStatus = 'active' | 'paused' | 'disabled' | 'archived';

export type BackupJobType = 'scheduled' | 'manual' | 'pre_deploy' | 'disaster_recovery';

export type BackupJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'verifying';

export type RestoreType = 'full' | 'partial' | 'point_in_time' | 'selective';

export type RestoreStatus = 'pending' | 'restoring' | 'completed' | 'failed' | 'verified';

export interface BackupPlan {
  id: string;
  agent_id: string;
  plan_name: string;
  source_type: BackupSourceType;
  source_path: string;
  destination: string;
  schedule_cron: string;
  retention_days: number;
  retention_count: number;
  compression: BackupCompression;
  encryption: boolean;
  incremental: boolean;
  status: BackupPlanStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BackupJob {
  id: string;
  plan_id: string;
  job_type: BackupJobType;
  size_bytes: number;
  duration_seconds: number;
  files_count: number;
  checksum: string | null;
  storage_path: string | null;
  status: BackupJobStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface BackupRestore {
  id: string;
  job_id: string;
  restore_target: string;
  restore_type: RestoreType;
  status: RestoreStatus;
  restored_files: number;
  duration_seconds: number;
  verification_passed: boolean | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}
