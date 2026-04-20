export type ChaosExperimentType = 'latency_injection' | 'failure_injection' | 'resource_stress' | 'network_partition' | 'dependency_kill';
export type BlastRadius = 'endpoint' | 'service' | 'cluster' | 'region';
export type ChaosStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'aborted';

export interface AgentChaosTesterConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  maxConcurrentExperiments: number;
  blastRadiusLimit: BlastRadius;
  safetyMode: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentChaosExperiment {
  id: string;
  configId: string;
  experimentName: string;
  experimentType: ChaosExperimentType;
  targetService?: string;
  hypothesis?: string;
  parameters: Record<string, unknown>;
  status: ChaosStatus;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentChaosResult {
  id: string;
  experimentId: string;
  hypothesisConfirmed?: boolean;
  observations: unknown[];
  impactScore?: number;
  recommendations: unknown[];
  recordedAt: Date;
}
