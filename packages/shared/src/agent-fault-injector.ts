// Batch 200: Fault Injector — chaos engineering, resilience testing

export interface FaultExperiment {
  id: string;
  agentId: string;
  experimentName: string;
  targetService: string;
  faultType: FaultType;
  severity: FaultSeverity;
  config: Record<string, unknown>;
  status: FaultExperimentStatus;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds: number;
  metadata: Record<string, unknown>;
}

export interface FaultObservation {
  id: string;
  experimentId: string;
  metricName: string;
  baselineValue?: number;
  observedValue?: number;
  deviationPct?: number;
  severity: FaultObservationSeverity;
  details: Record<string, unknown>;
  observedAt: string;
}

export interface FaultReport {
  id: string;
  experimentId: string;
  resilienceScore: number;
  recoveryTimeMs?: number;
  cascadingFailures: number;
  recommendations: string[];
  summary?: string;
}

export type FaultType = 'latency' | 'error' | 'abort' | 'throttle' | 'corrupt' | 'partition' | 'cpu_stress' | 'memory_stress';
export type FaultSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FaultExperimentStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'aborted' | 'failed';
export type FaultObservationSeverity = 'info' | 'warning' | 'critical';
export type FaultInjectorEvent = 'fault.experiment_started' | 'fault.experiment_completed' | 'fault.observation_recorded' | 'fault.report_generated';
