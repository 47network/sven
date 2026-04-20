export interface InfraScannerConfig {
  id: string;
  agentId: string;
  scanScope: string;
  scanType: string;
  severityThreshold: 'low' | 'medium' | 'high' | 'critical';
  lastScanAt: string | null;
  findingsCount: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ScanFinding {
  id: string;
  scanId: string;
  severity: string;
  category: string;
  resource: string;
  description: string;
  remediation: string;
  detectedAt: string;
}
export interface ScanReport {
  scanId: string;
  scope: string;
  totalFindings: number;
  bySeverity: Record<string, number>;
  completedAt: string;
}
