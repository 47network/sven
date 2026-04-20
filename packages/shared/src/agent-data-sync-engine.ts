export type SyncMode = 'full' | 'incremental' | 'bidirectional' | 'mirror';
export type SyncConnectionStatus = 'idle' | 'syncing' | 'error' | 'paused';
export type SyncRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type ConflictStrategy = 'latest_wins' | 'source_wins' | 'destination_wins' | 'manual';

export interface DataSyncEngineConfig {
  id: string;
  agentId: string;
  syncMode: SyncMode;
  conflictResolution: ConflictStrategy;
  batchSize: number;
  scheduleCron: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncConnection {
  id: string;
  configId: string;
  name: string;
  sourceType: string;
  sourceConfig: Record<string, unknown>;
  destinationType: string;
  destinationConfig: Record<string, unknown>;
  fieldMappings: Record<string, unknown>[];
  status: SyncConnectionStatus;
  lastSyncAt: Date | null;
  recordsSynced: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncRun {
  id: string;
  connectionId: string;
  status: SyncRunStatus;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorLog: Record<string, unknown>[];
  startedAt: Date;
  completedAt: Date | null;
}
