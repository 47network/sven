/* Batch 66 — Agent Data Export & Import */

export type ExportType = 'full' | 'partial' | 'incremental' | 'snapshot' | 'migration';
export type ExportFormat = 'json' | 'csv' | 'parquet' | 'sqlite' | 'archive';
export type ExportStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'expired';
export type ImportType = 'full' | 'partial' | 'merge' | 'overwrite' | 'migration';
export type ImportStatus = 'validating' | 'importing' | 'completed' | 'failed' | 'rolled_back';
export type ConflictStrategy = 'skip' | 'overwrite' | 'merge' | 'error';
export type DataTransferAction = 'export_create' | 'import_create' | 'schema_register' | 'mapping_create' | 'export_download' | 'import_validate' | 'transfer_status';

export const EXPORT_TYPES: ExportType[] = ['full', 'partial', 'incremental', 'snapshot', 'migration'];
export const EXPORT_FORMATS: ExportFormat[] = ['json', 'csv', 'parquet', 'sqlite', 'archive'];
export const IMPORT_TYPES: ImportType[] = ['full', 'partial', 'merge', 'overwrite', 'migration'];
export const CONFLICT_STRATEGIES: ConflictStrategy[] = ['skip', 'overwrite', 'merge', 'error'];

export interface DataExportJob {
  id: string;
  agentId: string;
  exportType: ExportType;
  exportFormat: ExportFormat;
  status: ExportStatus;
  scope: string;
  includeTables: string[];
  excludeTables: string[];
  filePath?: string;
  fileSizeBytes?: number;
  rowCount?: number;
  checksum?: string;
  expiresAt?: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DataImportJob {
  id: string;
  agentId: string;
  importType: ImportType;
  sourceFormat: ExportFormat;
  status: ImportStatus;
  filePath: string;
  fileSizeBytes?: number;
  rowsProcessed: number;
  rowsSkipped: number;
  rowsFailed: number;
  conflictStrategy: ConflictStrategy;
  validationErrors: unknown[];
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DataSchema {
  id: string;
  schemaName: string;
  schemaVersion: string;
  tableName: string;
  columns: unknown[];
  constraints: unknown[];
  isExportable: boolean;
  isImportable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DataMapping {
  id: string;
  mappingName: string;
  sourceSchema: string;
  targetSchema: string;
  fieldMappings: Record<string, unknown>;
  transformations: unknown[];
  isBidirectional: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DataTransferLog {
  id: string;
  jobId: string;
  jobType: 'export' | 'import';
  action: string;
  details: Record<string, unknown>;
  progressPct?: number;
  createdAt: string;
}

export function isExportComplete(job: DataExportJob): boolean {
  return job.status === 'completed' && !!job.filePath;
}

export function isImportSuccessful(job: DataImportJob): boolean {
  return job.status === 'completed' && job.rowsFailed === 0;
}

export function calculateImportSuccessRate(job: DataImportJob): number {
  const total = job.rowsProcessed + job.rowsSkipped + job.rowsFailed;
  if (total === 0) return 0;
  return Math.round((job.rowsProcessed / total) * 10000) / 100;
}

export function isJobExpired(job: DataExportJob): boolean {
  if (!job.expiresAt) return false;
  return new Date(job.expiresAt) < new Date();
}
