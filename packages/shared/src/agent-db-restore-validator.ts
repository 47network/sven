export interface DbRestoreValidatorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RestoreCheck {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ValidatorEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
