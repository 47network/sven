export type DriftType = 'added' | 'removed' | 'modified' | 'permissions' | 'config' | 'state';

export interface DriftDetectorConfig {
  id: string;
  agentId: string;
  scanIntervalHours: number;
  driftTolerancePct: number;
  autoRemediate: boolean;
  metadata: Record<string, unknown>;
}

export interface DriftBaseline {
  id: string;
  configId: string;
  resourceType: string;
  resourceId: string;
  expectedState: Record<string, unknown>;
  currentState: Record<string, unknown> | null;
  driftDetected: boolean;
  lastScannedAt: string | null;
}

export interface DriftEvent {
  id: string;
  baselineId: string;
  driftType: DriftType;
  fieldPath: string;
  expectedValue: string | null;
  actualValue: string | null;
  remediated: boolean;
  createdAt: string;
}
