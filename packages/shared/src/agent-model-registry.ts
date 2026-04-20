export interface ModelRegistryConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RegisteredModel {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface RegistryEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
