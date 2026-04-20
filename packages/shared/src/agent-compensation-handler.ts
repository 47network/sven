export interface CompensationHandlerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CompensationRecord {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface RollbackPlan {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
