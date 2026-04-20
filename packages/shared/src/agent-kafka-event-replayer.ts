export interface KafkaEventReplayerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReplayJob {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ReplayerEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
