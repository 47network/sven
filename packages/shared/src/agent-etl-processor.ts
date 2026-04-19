export type SourceType = 'database' | 'api' | 'file' | 'stream' | 'webhook';
export type SinkType = 'database' | 'api' | 'file' | 'stream' | 'warehouse';
export type EtlRunStatus = 'pending' | 'extracting' | 'transforming' | 'loading' | 'completed' | 'failed';

export interface EtlProcessorConfig {
  id: string;
  agentId: string;
  maxConcurrentJobs: number;
  batchSize: number;
  errorThresholdPercent: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EtlPipeline {
  id: string;
  configId: string;
  name: string;
  sourceType: SourceType;
  sourceConfig: Record<string, unknown>;
  transformSteps: Record<string, unknown>[];
  sinkType: SinkType;
  sinkConfig: Record<string, unknown>;
  scheduleCron?: string;
  lastRunAt?: Date;
  recordsProcessed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EtlRun {
  id: string;
  pipelineId: string;
  status: EtlRunStatus;
  recordsExtracted: number;
  recordsTransformed: number;
  recordsLoaded: number;
  recordsErrored: number;
  error?: string;
  durationMs?: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}
