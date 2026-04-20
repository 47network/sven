export type ProcessingMode = 'parallel' | 'sequential' | 'streaming' | 'chunked';
export type ErrorHandling = 'continue' | 'stop' | 'retry' | 'skip';
export type BatchJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type BatchItemStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface BatchProcessorConfig {
  id: string;
  agentId: string;
  name: string;
  defaultBatchSize: number;
  maxBatchSize: number;
  processingMode: ProcessingMode;
  errorHandling: ErrorHandling;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchJob {
  id: string;
  configId: string;
  name: string;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  skippedItems: number;
  batchSize: number;
  status: BatchJobStatus;
  inputSource?: string;
  outputDestination?: string;
  startedAt?: Date;
  completedAt?: Date;
  errorSummary: Record<string, unknown>;
  progressPct: number;
  createdAt: Date;
}

export interface BatchItem {
  id: string;
  batchJobId: string;
  itemIndex: number;
  inputData: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  status: BatchItemStatus;
  errorMessage?: string;
  processedAt?: Date;
  createdAt: Date;
}
