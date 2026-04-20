export interface SynonymMapperConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SynonymGroup {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface MapperEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
