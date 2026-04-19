// Batch 349: Config Sync types
export type SyncStrategy = 'eventual' | 'strong' | 'causal' | 'read_your_writes';
export type ConflictResolution = 'last_write_wins' | 'merge' | 'manual' | 'version_vector';
export type ConfigChangeType = 'create' | 'update' | 'delete' | 'rollback';
export type ConfigScope = 'global' | 'service' | 'agent' | 'environment';

export interface ConfigSyncConfig {
  id: string;
  agentId: string;
  namespace: string;
  syncStrategy: SyncStrategy;
  conflictResolution: ConflictResolution;
  pollIntervalMs: number;
  encryptionEnabled: boolean;
  versionTracking: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfigEntry {
  id: string;
  configId: string;
  key: string;
  value: Record<string, unknown>;
  version: number;
  checksum?: string;
  sourceNode?: string;
  isEncrypted: boolean;
  updatedAt: Date;
  createdAt: Date;
}

export interface ConfigHistory {
  id: string;
  entryId: string;
  previousValue?: Record<string, unknown>;
  newValue: Record<string, unknown>;
  changedBy?: string;
  changeReason?: string;
  version: number;
  createdAt: Date;
}
