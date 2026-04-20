export interface ThumbnailGeneratorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ThumbnailSpec {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface GenerationResult {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
