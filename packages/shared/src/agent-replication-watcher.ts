export interface ReplicationWatcherConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReplicaStatus {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface LagAlert {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
