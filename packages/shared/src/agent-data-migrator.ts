// Batch 357: Data Migrator types

export type SourceType = 'postgresql' | 'mysql' | 'mongodb' | 'elasticsearch' | 'csv' | 'json' | 'api';
export type MigrationMode = 'full' | 'incremental' | 'differential' | 'cdc';
export type MigrationPlanStatus = 'draft' | 'validated' | 'running' | 'completed' | 'failed' | 'rolled_back';
export type RunStatus = 'pending' | 'extracting' | 'transforming' | 'loading' | 'validating' | 'completed' | 'failed' | 'rolled_back';

export interface DataMigratorConfig {
  id: string;
  agentId: string;
  name: string;
  sourceType: SourceType;
  targetType: SourceType;
  migrationMode: MigrationMode;
  batchSize: number;
  parallelWorkers: number;
  validationEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MigrationPlan {
  id: string;
  configId: string;
  planName: string;
  sourceSchema: Record<string, unknown>;
  targetSchema: Record<string, unknown>;
  fieldMappings: unknown[];
  transformations: unknown[];
  estimatedRows?: number;
  status: MigrationPlanStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MigrationRun {
  id: string;
  planId: string;
  runStatus: RunStatus;
  rowsExtracted: number;
  rowsTransformed: number;
  rowsLoaded: number;
  rowsFailed: number;
  validationErrors: unknown[];
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}
