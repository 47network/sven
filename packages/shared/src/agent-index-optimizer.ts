export type TargetDatabase = 'postgresql' | 'mysql' | 'mongodb' | 'opensearch' | 'sqlite';
export type AnalysisStatus = 'analyzing' | 'completed' | 'applied' | 'failed' | 'stale';
export type IndexOperationType = 'create' | 'drop' | 'rebuild' | 'reindex' | 'alter';
export type IndexOperationStatus = 'pending' | 'applied' | 'rolled_back' | 'failed' | 'skipped';

export interface IndexOptimizerConfig {
  id: string;
  agentId: string;
  targetDatabase: TargetDatabase;
  analysisSchedule: string;
  autoApply: boolean;
  maxIndexSizeMb: number;
  minImprovementPercent: number;
  includeSchemas: string[];
  excludeTables: string[];
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IndexAnalysis {
  id: string;
  configId: string;
  agentId: string;
  tableName: string;
  currentIndexes: unknown[];
  recommendedIndexes: unknown[];
  redundantIndexes: unknown[];
  estimatedImprovementPercent?: number;
  tableSizeBytes?: number;
  totalQueriesAnalyzed: number;
  status: AnalysisStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface IndexOperation {
  id: string;
  analysisId: string;
  operationType: IndexOperationType;
  indexName: string;
  tableName: string;
  indexDefinition?: string;
  status: IndexOperationStatus;
  appliedAt?: string;
  rollbackSql?: string;
  impactMetrics: Record<string, unknown>;
  createdAt: string;
}
