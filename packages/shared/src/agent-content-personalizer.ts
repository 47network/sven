export interface ContentPersonalizerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalizedFeed {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface PersonalizerEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
