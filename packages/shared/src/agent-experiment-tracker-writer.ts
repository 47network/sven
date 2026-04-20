export interface ExperimentTrackerWriterConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RunRecord {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface WriterEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
