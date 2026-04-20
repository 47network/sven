export interface StreamJoinerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface JoinedStream {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface JoinWindow {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
