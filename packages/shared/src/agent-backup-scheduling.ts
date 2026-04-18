// Batch 111 — Agent Backup Scheduling types

export type BackupStorageBackend = 's3' | 'gcs' | 'azure_blob' | 'local' | 'nfs';
export type BackupCompression = 'none' | 'gzip' | 'zstd' | 'lz4';
export type BackupSnapshotStatus = 'in_progress' | 'completed' | 'failed' | 'expired' | 'deleted';
export type BackupRestoreStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface BackupSchedule {
  id: string;
  agentId: string;
  scheduleName: string;
  resourceType: string;
  resourceId: string;
  cronExpression: string;
  retentionDays: number;
  storageBackend: BackupStorageBackend;
  compression: BackupCompression;
  encryptionEnabled: boolean;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupSnapshot {
  id: string;
  agentId: string;
  scheduleId: string;
  snapshotKey: string;
  sizeBytes: number;
  checksum: string | null;
  status: BackupSnapshotStatus;
  startedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface BackupRestoreJob {
  id: string;
  agentId: string;
  snapshotId: string;
  targetResourceId: string;
  status: BackupRestoreStatus;
  progressPct: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupSchedulingStats {
  totalSchedules: number;
  activeSchedules: number;
  totalSnapshots: number;
  totalSizeBytes: number;
  restoresLast24h: number;
}
