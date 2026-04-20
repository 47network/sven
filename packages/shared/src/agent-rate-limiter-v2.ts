export interface RateLimiterV2Config {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RateBucket {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface LimiterEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
