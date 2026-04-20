export interface DataArchiverConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  archiveTargets: string[];
  retentionDays: number;
  compression: string;
  storageBackend: string;
  archiveSchedule: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface ArchiveJob {
  jobId: string;
  tableName: string;
  recordsArchived: number;
  compressedSizeBytes: number;
  destination: string;
  startedAt: string;
  completedAt: string;
}
export interface ArchivePolicy {
  tableName: string;
  retentionDays: number;
  archiveCondition: string;
  compression: string;
  verified: boolean;
}
