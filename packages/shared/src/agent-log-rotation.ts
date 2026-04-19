export type LogCompressionAlgo = 'gzip' | 'zstd' | 'lz4' | 'none';
export type LogArchiveBackend = 's3' | 'gcs' | 'azure_blob' | 'local';
export type LogArchiveStatus = 'pending' | 'archiving' | 'completed' | 'failed' | 'expired';
export type LogRetentionJobType = 'purge' | 'archive' | 'compress';

export interface LogRotationPolicy {
  id: string;
  agentId: string;
  policyName: string;
  logSource: string;
  rotationInterval: string;
  maxFileSizeMb: number;
  retentionDays: number;
  compression: LogCompressionAlgo;
  archiveBackend: LogArchiveBackend;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LogArchive {
  id: string;
  policyId: string;
  agentId: string;
  archivePath: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  logStartTime: string;
  logEndTime: string;
  checksum: string;
  status: LogArchiveStatus;
  createdAt: string;
}

export interface LogRetentionJob {
  id: string;
  policyId: string;
  agentId: string;
  jobType: LogRetentionJobType;
  archivesProcessed: number;
  bytesReclaimed: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface LogRotationStats {
  totalPolicies: number;
  activePolicies: number;
  totalArchives: number;
  totalBytesArchived: number;
  totalBytesReclaimed: number;
}
