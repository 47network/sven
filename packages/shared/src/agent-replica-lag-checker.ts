export interface ReplicaLagCheckerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LagMeasurement {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface CheckerEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
