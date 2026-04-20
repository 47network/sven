export interface AccessReviewOptPlan {
  id: string;
  agentId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AccessReviewOptConfig {
  id: string;
  configId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface AccessReviewOptResult {
  id: string;
  configId: string;
  criteria: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}
