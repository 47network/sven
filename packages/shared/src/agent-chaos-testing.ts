export type ChaosStatus = 'draft' | 'running' | 'paused' | 'completed' | 'aborted';
export type ChaosBlastRadius = 'single' | 'crew' | 'district' | 'global';
export type ChaosFaultType = 'latency' | 'error' | 'timeout' | 'partition' | 'resource_exhaustion' | 'data_corruption';

export interface AgentChaosExperiment {
  id: string;
  agentId: string;
  name: string;
  hypothesis: string | null;
  status: ChaosStatus;
  blastRadius: ChaosBlastRadius;
  durationMs: number;
  startedAt: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentChaosFault {
  id: string;
  experimentId: string;
  faultType: ChaosFaultType;
  targetAgentId: string | null;
  targetService: string | null;
  intensity: number;
  config: Record<string, unknown>;
  injectedAt: string | null;
  removedAt: string | null;
  createdAt: string;
}

export interface AgentChaosResult {
  id: string;
  experimentId: string;
  faultId: string | null;
  metricName: string;
  baselineValue: number | null;
  actualValue: number | null;
  threshold: number | null;
  passed: boolean;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AgentChaosTestingStats {
  totalExperiments: number;
  runningExperiments: number;
  completedExperiments: number;
  abortedExperiments: number;
  totalFaults: number;
  overallPassRate: number;
}
