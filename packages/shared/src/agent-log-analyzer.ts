export type LogSource = 'application' | 'system' | 'security' | 'audit' | 'custom';
export type AnalysisStatus = 'analyzing' | 'completed' | 'failed' | 'partial';
export type PatternType = 'error_cluster' | 'anomaly' | 'trend' | 'correlation' | 'regression';
export type LogSeverity = 'critical' | 'error' | 'warning' | 'info' | 'debug';

export interface LogAnalyzerConfig {
  id: string;
  agentId: string;
  logSources: LogSource[];
  patternDetection: boolean;
  anomalySensitivity: number;
  retentionDays: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LogAnalysis {
  id: string;
  configId: string;
  agentId: string;
  source: string;
  timeRangeStart: Date;
  timeRangeEnd: Date;
  totalEntries: number;
  errorCount: number;
  warningCount: number;
  patternsFound: number;
  status: AnalysisStatus;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface LogPattern {
  id: string;
  analysisId: string;
  patternType: PatternType;
  patternSignature: string;
  occurrenceCount: number;
  severity: LogSeverity;
  firstSeen: Date;
  lastSeen: Date;
  sampleEntries: unknown[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}
