export interface TrainingSchedulerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingJob {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface SchedulerEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
