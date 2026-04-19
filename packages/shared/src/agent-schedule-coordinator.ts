export type OverlapPolicy = 'skip' | 'queue' | 'cancel_running' | 'allow' | 'error';
export type JobStatus = 'active' | 'paused' | 'disabled' | 'expired' | 'completed';
export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';
export type JobType = 'task' | 'workflow' | 'maintenance' | 'report' | 'sync';

export interface ScheduleCoordinatorConfig {
  id: string;
  agentId: string;
  timezone: string;
  maxConcurrentJobs: number;
  overlapPolicy: OverlapPolicy;
  heartbeatIntervalSeconds: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledJob {
  id: string;
  configId: string;
  agentId: string;
  jobName: string;
  cronExpression: string;
  jobType: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  failureCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface JobExecution {
  id: string;
  jobId: string;
  executionStatus: ExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  resultData?: Record<string, unknown>;
  errorMessage?: string;
  retryCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
