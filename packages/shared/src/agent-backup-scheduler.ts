export type BackupType = 'full' | 'incremental' | 'differential' | 'wal' | 'snapshot';
export type BackupState = 'running' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface AgentBackupSchedConfig {
  id: string; agent_id: string; backup_type: BackupType; schedule_cron: string;
  retention_count: number; storage_path: string; compression: boolean; encryption: boolean;
  status: string; created_at: string; updated_at: string;
}
export interface AgentBackupRun {
  id: string; config_id: string; backup_type: BackupType; size_bytes: number;
  duration_seconds: number; state: BackupState; storage_path: string; checksum: string;
  started_at: string; completed_at: string | null;
}
export interface AgentBackupRestore {
  id: string; backup_id: string; target_db: string; state: string;
  point_in_time: string | null; duration_seconds: number;
  started_at: string; completed_at: string | null;
}
