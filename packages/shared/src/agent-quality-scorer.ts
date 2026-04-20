export interface QualityScorerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ScoreCard {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ScoringEvent {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
