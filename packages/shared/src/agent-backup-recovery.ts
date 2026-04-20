/* Batch 59 — Agent Backup & Recovery shared types */

export type BackupType = 'full' | 'incremental' | 'differential' | 'snapshot' | 'selective';

export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type RecoveryType = 'full' | 'partial' | 'point_in_time' | 'granular' | 'cross_region';

export type RecoveryPointStatus = 'available' | 'restoring' | 'restored' | 'expired' | 'corrupted';

export type DrPriority = 'low' | 'medium' | 'high' | 'critical' | 'emergency';

export type RestoreType = 'manual' | 'automatic' | 'scheduled' | 'dr_failover' | 'test';

export type BackupRecoveryAction =
  | 'backup_create'
  | 'backup_restore'
  | 'recovery_point_create'
  | 'retention_set'
  | 'dr_plan_create'
  | 'dr_test'
  | 'restore_log_query';

export interface AgentBackupJobRow {
  id: string;
  agent_id: string;
  backup_type: BackupType;
  status: BackupStatus;
  source_path: string | null;
  destination: string | null;
  size_bytes: number;
  checksum: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentRecoveryPointRow {
  id: string;
  agent_id: string;
  backup_job_id: string | null;
  recovery_type: RecoveryType;
  status: RecoveryPointStatus;
  snapshot_data: Record<string, unknown>;
  restore_target: string | null;
  restored_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentRetentionPolicyRow {
  id: string;
  agent_id: string;
  policy_name: string;
  retention_days: number;
  max_backups: number | null;
  backup_type: BackupType;
  schedule_cron: string | null;
  is_active: boolean;
  last_applied_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentDisasterRecoveryPlanRow {
  id: string;
  agent_id: string;
  plan_name: string;
  priority: DrPriority;
  rto_minutes: number;
  rpo_minutes: number;
  failover_target: string | null;
  steps: unknown[];
  last_tested_at: string | null;
  test_result: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentRestoreLogRow {
  id: string;
  agent_id: string;
  recovery_point_id: string | null;
  dr_plan_id: string | null;
  restore_type: RestoreType;
  status: string;
  items_restored: number;
  items_failed: number;
  duration_ms: number;
  error_log: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const BACKUP_TYPES: readonly BackupType[] = ['full', 'incremental', 'differential', 'snapshot', 'selective'] as const;
export const BACKUP_STATUSES: readonly BackupStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;
export const RECOVERY_TYPES: readonly RecoveryType[] = ['full', 'partial', 'point_in_time', 'granular', 'cross_region'] as const;
export const RECOVERY_POINT_STATUSES: readonly RecoveryPointStatus[] = ['available', 'restoring', 'restored', 'expired', 'corrupted'] as const;
export const DR_PRIORITIES: readonly DrPriority[] = ['low', 'medium', 'high', 'critical', 'emergency'] as const;
export const RESTORE_TYPES: readonly RestoreType[] = ['manual', 'automatic', 'scheduled', 'dr_failover', 'test'] as const;

export function isBackupComplete(status: BackupStatus): boolean {
  return status === 'completed';
}

export function isRecoveryPointUsable(status: RecoveryPointStatus): boolean {
  return status === 'available';
}

export function isDrPlanCritical(priority: DrPriority): boolean {
  return priority === 'critical' || priority === 'emergency';
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
