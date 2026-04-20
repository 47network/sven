export interface DataWarehouseLoaderConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseLoad {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface LoaderEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
