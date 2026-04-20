export interface ShardBalancerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ShardAssignment {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface BalancerEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
