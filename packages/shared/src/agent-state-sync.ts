/* Batch 147 — Agent State Sync */

export enum SyncDirection {
  Push = 'push',
  Pull = 'pull',
  Bidirectional = 'bidirectional',
}

export enum ConflictPolicy {
  LastWriteWins = 'last_write_wins',
  FirstWriteWins = 'first_write_wins',
  Manual = 'manual',
  Merge = 'merge',
  VectorClock = 'vector_clock',
}

export enum SyncOperation {
  Push = 'push',
  Pull = 'pull',
  Merge = 'merge',
  ConflictResolve = 'conflict_resolve',
  FullSync = 'full_sync',
  DeltaSync = 'delta_sync',
}

export enum SyncOpStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
  Conflict = 'conflict',
}

export interface SyncPeer {
  id: string;
  agentId: string;
  peerAgentId: string;
  direction: SyncDirection;
  conflictPolicy: ConflictPolicy;
  syncInterval: number;
  isActive: boolean;
  lastSyncAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncState {
  id: string;
  peerId: string;
  stateKey: string;
  stateValue: Record<string, unknown>;
  vectorClock: Record<string, unknown>;
  version: number;
  checksum?: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncOperationRecord {
  id: string;
  peerId: string;
  operation: SyncOperation;
  status: SyncOpStatus;
  keysSynced: number;
  conflictsFound: number;
  durationMs?: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface StateSyncStats {
  totalPeers: number;
  activePeers: number;
  totalSyncs: number;
  totalConflicts: number;
  avgSyncDurationMs: number;
  syncSuccessRate: number;
}
