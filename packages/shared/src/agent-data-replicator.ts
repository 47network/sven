export interface DataReplicatorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  sourceConfig: Record<string, unknown>;
  targetConfig: Record<string, unknown>;
  replicationMode: string;
  conflictResolution: string;
  syncIntervalSeconds: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface ReplicationStatus {
  sourceId: string;
  targetId: string;
  lag: number;
  lastSyncAt: string;
  status: 'synced' | 'lagging' | 'error';
  recordsReplicated: number;
}
export interface ReplicationConflict {
  recordId: string;
  sourceValue: unknown;
  targetValue: unknown;
  resolution: string;
  resolvedAt: string;
}
