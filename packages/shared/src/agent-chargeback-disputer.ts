export interface ChargebackDisputerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChargebackCase {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface DisputerEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
