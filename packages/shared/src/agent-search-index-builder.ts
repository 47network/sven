export interface SearchIndexBuilderConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SearchIndex {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface BuilderEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
