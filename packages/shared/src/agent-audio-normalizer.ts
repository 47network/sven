export interface AudioNormalizerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizationJob {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface NormalizerEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
