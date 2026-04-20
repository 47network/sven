export interface FaultSimulatorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FaultScenario {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface SimulatorEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
