export type RetryPolicy = 'none' | 'fixed' | 'exponential' | 'linear';
export type PipelineStatus = 'idle' | 'running' | 'paused' | 'failed' | 'completed';
export type PipelineRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface DataPipelineRunnerConfig {
  id: string;
  agentId: string;
  maxConcurrentPipelines: number;
  defaultTimeoutMinutes: number;
  retryPolicy: RetryPolicy;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Pipeline {
  id: string;
  configId: string;
  name: string;
  dag: Record<string, unknown>;
  schedule?: string;
  status: PipelineStatus;
  lastRunAt?: string;
  createdAt: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  startedAt: string;
  completedAt?: string;
  status: PipelineRunStatus;
  stepsTotal: number;
  stepsCompleted: number;
  output: Record<string, unknown>;
  createdAt: string;
}
