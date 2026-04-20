export type SeverityThreshold = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ScanType = 'full' | 'incremental' | 'quick' | 'deep';
export type ScanStatus = 'scanning' | 'completed' | 'failed' | 'cancelled';
export type FindingStatus = 'open' | 'acknowledged' | 'fixed' | 'ignored' | 'false_positive';

export interface DependencyScannerConfig {
  id: string;
  agentId: string;
  scanSchedule: string;
  severityThreshold: SeverityThreshold;
  autoUpdatePatch: boolean;
  packageManagers: string[];
  ignorePatterns: string[];
  notificationChannels: string[];
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DependencyScan {
  id: string;
  configId: string;
  agentId: string;
  scanType: ScanType;
  totalDependencies: number;
  vulnerableCount: number;
  outdatedCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  status: ScanStatus;
  completedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface VulnerabilityFinding {
  id: string;
  scanId: string;
  packageName: string;
  currentVersion: string;
  patchedVersion?: string;
  severity: SeverityThreshold;
  cveId?: string;
  description?: string;
  fixAvailable: boolean;
  autoFixable: boolean;
  status: FindingStatus;
  resolvedAt?: string;
  createdAt: string;
}
