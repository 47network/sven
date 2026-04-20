export type SliType = 'availability' | 'latency' | 'throughput' | 'error_rate' | 'saturation';
export type SlaStatus = 'met' | 'at_risk' | 'breached' | 'unknown';
export type ViolationType = 'downtime' | 'degradation' | 'error_spike' | 'latency_spike';
export type MeasurementWindow = '1d' | '7d' | '30d' | '90d' | '365d';

export interface SlaTrackerConfig {
  id: string;
  agentId: string;
  defaultTarget: number;
  measurementWindow: MeasurementWindow;
  burnRateThreshold: number;
  errorBudgetAlert: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlaObjective {
  id: string;
  configId: string;
  agentId: string;
  serviceName: string;
  sliType: SliType;
  targetPercentage: number;
  currentPercentage: number | null;
  errorBudgetRemaining: number | null;
  measurementStart: Date;
  measurementEnd: Date;
  status: SlaStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface SlaViolation {
  id: string;
  objectiveId: string;
  violationType: ViolationType;
  durationSeconds: number;
  impactPercentage: number | null;
  rootCause: string | null;
  startedAt: Date;
  endedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
