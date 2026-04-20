export type SnapshotStatus = 'active' | 'archived' | 'rolled_back' | 'expired';
export type RollbackStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type RollbackInitiator = 'system' | 'agent' | 'admin' | 'auto_failsafe';

export interface AgentRollbackManagerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  maxSnapshots: number;
  autoRollbackOnFailure: boolean;
  retentionDays: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentDeploymentSnapshot {
  id: string;
  configId: string;
  deploymentId: string;
  version: string;
  snapshotData: Record<string, unknown>;
  status: SnapshotStatus;
  createdAt: Date;
}

export interface AgentRollbackOperation {
  id: string;
  snapshotId: string;
  reason?: string;
  initiatedBy: RollbackInitiator;
  status: RollbackStatus;
  startedAt: Date;
  completedAt?: Date;
}
