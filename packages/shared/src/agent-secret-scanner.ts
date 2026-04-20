export interface SecretScannerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  scanTargets: string[];
  patternRules: Record<string, unknown>[];
  scanSchedule: string;
  severityThreshold: string;
  autoRemediate: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface SecretFinding {
  findingId: string;
  location: string;
  secretType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  remediated: boolean;
  detectedAt: string;
}
export interface ScanReport {
  scanId: string;
  targetsScanned: number;
  findingsCount: number;
  criticalCount: number;
  completedAt: string;
}
