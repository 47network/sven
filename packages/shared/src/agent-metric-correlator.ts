export interface MetricCorrelatorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Correlation {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface CorrelatorEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
