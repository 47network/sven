export type DriftResourceType = 'vm' | 'container' | 'service' | 'database' | 'network' | 'dns';
export type DriftType = 'added' | 'removed' | 'modified' | 'type_changed';
export type DriftSeverity = 'critical' | 'warning' | 'info';
export type DriftScanType = 'full' | 'incremental' | 'targeted';
export type DriftScanStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ConfigBaseline {
  id: string;
  agentId: string;
  resourceType: DriftResourceType;
  resourceId: string;
  name: string;
  baselineConfig: Record<string, unknown>;
  version: number;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigDriftEvent {
  id: string;
  baselineId: string;
  driftType: DriftType;
  configPath: string;
  expectedValue: string | null;
  actualValue: string | null;
  severity: DriftSeverity;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  autoRemediated: boolean;
}

export interface ConfigScanJob {
  id: string;
  agentId: string;
  scanType: DriftScanType;
  status: DriftScanStatus;
  resourcesScanned: number;
  driftsFound: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ConfigDriftStats {
  totalBaselines: number;
  totalDrifts: number;
  unresolvedDrifts: number;
  criticalDrifts: number;
  lastScanAt: string | null;
}
