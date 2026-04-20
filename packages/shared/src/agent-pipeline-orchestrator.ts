export type PipelineStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type StageType = 'transform' | 'validate' | 'enrich' | 'filter' | 'aggregate' | 'output';
export type RetryPolicy = 'none' | 'linear' | 'exponential' | 'fixed';
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineOrchestratorConfig {
  id: string;
  agentId: string;
  maxConcurrentPipelines: number;
  defaultTimeoutSeconds: number;
  retryPolicy: RetryPolicy;
  maxRetries: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentPipeline {
  id: string;
  configId: string;
  agentId: string;
  pipelineName: string;
  description?: string;
  stageCount: number;
  currentStage: number;
  status: PipelineStatus;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  stageName: string;
  stageOrder: number;
  stageType: StageType;
  inputConfig: Record<string, unknown>;
  outputConfig: Record<string, unknown>;
  status: StageStatus;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
