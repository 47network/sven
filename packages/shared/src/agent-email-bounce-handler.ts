export interface EmailBounceHandlerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BounceEvent {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface HandlerEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
