// Batch 355: Job Scheduler types

export type SchedulerType = 'cron' | 'interval' | 'once' | 'event_driven' | 'dependency';
export type RetryPolicy = 'none' | 'fixed' | 'exponential' | 'linear';
export type JobStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';

export interface JobSchedulerConfig {
  id: string;
  agentId: string;
  name: string;
  schedulerType: SchedulerType;
  timezone: string;
  maxConcurrent: number;
  retryPolicy: RetryPolicy;
  maxRetries: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledJob {
  id: string;
  configId: string;
  jobName: string;
  jobType: string;
  scheduleExpression?: string;
  jobPayload: Record<string, unknown>;
  status: JobStatus;
  nextRunAt?: string;
  lastRunAt?: string;
  runCount: number;
  failureCount: number;
  timeoutSeconds: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface JobExecution {
  id: string;
  jobId: string;
  executionStatus: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  result?: unknown;
  errorMessage?: string;
  retryAttempt: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}
