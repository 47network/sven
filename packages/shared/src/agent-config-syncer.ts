export interface ConfigSyncerConfig {
  id: string;
  agentId: string;
  configKey: string;
  syncIntervalSeconds: number;
  sourceType: string;
  lastSyncedAt: string | null;
  conflictResolution: 'latest_wins' | 'manual' | 'source_priority';
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface SyncResult {
  configKey: string;
  previousValue: string | null;
  newValue: string;
  source: string;
  conflictsDetected: number;
  syncedAt: string;
}
export interface SyncConflict {
  configKey: string;
  sourceValue: string;
  targetValue: string;
  resolution: string;
  resolvedAt: string | null;
}
