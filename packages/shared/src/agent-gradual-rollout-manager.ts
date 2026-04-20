export type RolloutStatus = 'pending' | 'rolling' | 'paused' | 'completed' | 'rolled_back';
export type RolloutStepStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface GradualRolloutManagerConfig {
  id: string;
  agentId: string;
  defaultIncrement: number;
  observationWindowMs: number;
  errorThresholdPct: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Rollout {
  id: string;
  configId: string;
  featureKey: string;
  currentPercentage: number;
  targetPercentage: number;
  increment: number;
  status: RolloutStatus;
  createdAt: string;
}

export interface RolloutStep {
  id: string;
  rolloutId: string;
  fromPercentage: number;
  toPercentage: number;
  errorRate: number;
  status: RolloutStepStatus;
  startedAt?: string;
  completedAt?: string;
}
