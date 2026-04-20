export interface ThrottleControllerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ThrottleRule {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ThrottleMetric {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
