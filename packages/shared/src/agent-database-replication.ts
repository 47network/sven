// Batch 107 — Agent Database Replication

export type DbReplicaRole = 'primary' | 'replica' | 'standby' | 'witness';
export type DbReplicaStatus = 'healthy' | 'lagging' | 'unreachable' | 'promoting' | 'demoting' | 'failed';
export type DbReplicationMode = 'sync' | 'async' | 'semi_sync';
export type DbFailoverTrigger = 'manual' | 'auto_lag' | 'auto_unreachable' | 'auto_health' | 'scheduled';
export type DbFailoverStatus = 'initiated' | 'fencing' | 'promoting' | 'reconfiguring' | 'completed' | 'failed' | 'rolled_back';
export type DbSlotType = 'physical' | 'logical';

export interface DbReplica {
  id: string;
  agentId: string;
  clusterName: string;
  replicaHost: string;
  replicaPort: number;
  role: DbReplicaRole;
  status: DbReplicaStatus;
  replicationMode: DbReplicationMode;
  lagBytes: number;
  lagSeconds: number;
  lastHeartbeat: string;
}

export interface DbFailover {
  id: string;
  clusterName: string;
  oldPrimary: string;
  newPrimary: string;
  triggerReason: DbFailoverTrigger;
  status: DbFailoverStatus;
  dataLossBytes: number;
  downtimeMs: number;
  initiatedAt: string;
  completedAt: string | null;
}

export interface DbReplicationSlot {
  id: string;
  replicaId: string;
  slotName: string;
  slotType: DbSlotType;
  active: boolean;
  retainedBytes: number;
  confirmedLsn: string | null;
}

export interface DbReplicationStats {
  totalClusters: number;
  totalReplicas: number;
  healthyReplicas: number;
  avgLagSeconds: number;
  failoversLast24h: number;
  dataLossBytesTotal: number;
}
