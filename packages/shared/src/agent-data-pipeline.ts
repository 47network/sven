/* Batch 131 — Agent Data Pipeline */

export type PipelineType = 'etl' | 'elt' | 'streaming' | 'batch' | 'cdc';

export type PipelineSourceType = 'postgres' | 'mysql' | 's3' | 'api' | 'kafka' | 'file' | 'webhook';

export type PipelineSinkType = 'postgres' | 'opensearch' | 's3' | 'api' | 'kafka' | 'warehouse';

export type PipelineRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

export type DataTransformType = 'map' | 'filter' | 'aggregate' | 'join' | 'enrich' | 'deduplicate' | 'validate';

export interface DataPipeline {
  id: string;
  agentId: string;
  pipelineName: string;
  pipelineType: PipelineType;
  sourceType: PipelineSourceType;
  sinkType: PipelineSinkType;
  scheduleCron?: string;
  enabled: boolean;
  lastRunStatus?: PipelineRunStatus;
  lastRunAt?: string;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  status: PipelineRunStatus;
  recordsRead: number;
  recordsWritten: number;
  recordsFailed: number;
  bytesProcessed: number;
  durationMs?: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export interface PipelineTransform {
  id: string;
  pipelineId: string;
  transformName: string;
  transformType: DataTransformType;
  transformOrder: number;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface DataPipelineStats {
  totalPipelines: number;
  activePipelines: number;
  totalRunsToday: number;
  successRate: number;
  recordsProcessed: number;
}
