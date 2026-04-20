// Batch 348: Log Router types
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type PipelineStatus = 'idle' | 'running' | 'paused' | 'error' | 'draining';
export type LogDestination = 'stdout' | 'file' | 'opensearch' | 'nats' | 's3' | 'webhook';
export type SamplingMode = 'fixed_rate' | 'adaptive' | 'priority' | 'none';

export interface LogRouterConfig {
  id: string;
  agentId: string;
  routerName: string;
  sourcePattern: string;
  destination: LogDestination;
  filterRules: Record<string, unknown>[];
  samplingRate: number;
  formatTemplate?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LogPipeline {
  id: string;
  configId: string;
  pipelineName: string;
  stages: Record<string, unknown>[];
  throughputLimit: number;
  bufferSize: number;
  status: PipelineStatus;
  lastProcessedAt?: Date;
  createdAt: Date;
}

export interface LogEntry {
  id: string;
  pipelineId: string;
  level: LogLevel;
  source: string;
  message: string;
  metadata: Record<string, unknown>;
  routedTo?: string;
  processedAt: Date;
}
