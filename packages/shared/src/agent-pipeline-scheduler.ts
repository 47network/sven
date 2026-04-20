export type TriggerType = 'manual' | 'cron' | 'event' | 'dependency' | 'webhook';
export type PipelineRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface PipelineSchedulerConfig {
  id: string;
  agentId: string;
  timezone: string;
  maxConcurrentPipelines: number;
  catchupEnabled: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentPipeline {
  id: string;
  configId: string;
  name: string;
  description?: string;
  scheduleCron?: string;
  triggerType: TriggerType;
  pipelineDefinition: Record<string, unknown>;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  status: PipelineRunStatus;
  triggerReason?: string;
  inputParams?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  durationMs?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}
