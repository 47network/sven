export type FailureType = 'latency' | 'error' | 'crash' | 'packet_loss' | 'resource_exhaustion';
export type ExperimentStatus = 'pending' | 'running' | 'completed' | 'aborted' | 'failed';

export interface FailureInjectorConfig {
  id: string;
  agentId: string;
  targetService: string;
  failureTypes: FailureType[];
  blastRadius: string;
  safetyLimits: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FailureExperiment {
  id: string;
  configId: string;
  name: string;
  hypothesis?: string;
  failureType: FailureType;
  parameters: Record<string, unknown>;
  status: ExperimentStatus;
  startedAt?: string;
  completedAt?: string;
  results: Record<string, unknown>;
}

export interface FailureReport {
  id: string;
  experimentId: string;
  impactScore: number;
  recoveryTimeMs?: number;
  findings: unknown[];
  recommendations: unknown[];
  createdAt: string;
}
