// Batch 101 — Agent Chaos Engineering shared types

export type ChaosFaultType = 'latency' | 'error' | 'cpu_stress' | 'memory_stress' | 'network_partition' | 'disk_fill' | 'process_kill' | 'dns_failure';

export type ChaosBlastRadius = 'single_instance' | 'service' | 'zone' | 'region' | 'global';

export type ChaosExperimentStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'aborted' | 'failed';

export type ChaosFindingSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ChaosExperiment {
  id: string;
  agentId: string;
  experimentName: string;
  hypothesis: string;
  targetService: string;
  faultType: ChaosFaultType;
  faultConfig: Record<string, unknown>;
  blastRadius: ChaosBlastRadius;
  durationSeconds: number;
  rollbackStrategy: string;
  status: ChaosExperimentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChaosRun {
  id: string;
  experimentId: string;
  startedBy: string;
  steadyStateBefore: Record<string, unknown>;
  steadyStateAfter: Record<string, unknown> | null;
  hypothesisConfirmed: boolean | null;
  incidentsTriggered: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

export interface ChaosFinding {
  id: string;
  runId: string;
  findingType: string;
  severity: ChaosFindingSeverity;
  description: string;
  affectedService: string;
  remediation: string | null;
  resolved: boolean;
  createdAt: string;
}

export interface ChaosResilienceScore {
  overallScore: number;
  experimentsRun: number;
  hypothesesConfirmed: number;
  weaknessesFound: number;
  weaknessesResolved: number;
  meanTimeToRecovery: number;
}
