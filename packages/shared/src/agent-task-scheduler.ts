export type ScheduleStatus = 'active' | 'paused' | 'expired' | 'completed';
export type JobRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';
export type ScheduleFrequency = 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface TaskSchedulerConfig {
  id: string;
  agentId: string;
  name: string;
  timezone: string;
  maxConcurrentJobs: number;
  retryOnFailure: boolean;
  maxRetries: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledJob {
  id: string;
  configId: string;
  name: string;
  cronExpression: string;
  taskType: string;
  taskPayload: Record<string, unknown>;
  nextRunAt?: Date;
  lastRunAt?: Date;
  status: ScheduleStatus;
  runCount: number;
  maxRuns?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobRun {
  id: string;
  jobId: string;
  status: JobRunStatus;
  startedAt?: Date;
  completedAt?: Date;
  result: Record<string, unknown>;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
}
