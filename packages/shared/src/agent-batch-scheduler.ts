export interface BatchSchedulerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledBatch {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface BatchExecution {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
