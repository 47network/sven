export interface TablePartitionerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PartitionPlan {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface PartitionEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
