export interface RefreshTokenRotatorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RefreshSession {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface RotatorEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
