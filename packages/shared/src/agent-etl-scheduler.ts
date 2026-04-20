export type ScheduleStatus = 'active' | 'paused' | 'disabled' | 'expired';
export type TriggerType = 'scheduled' | 'manual' | 'event' | 'dependency';
export type MissedRunPolicy = 'skip' | 'run_once' | 'run_all' | 'alert';
export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface EtlSchedulerConfig {
  id: string;
  agentId: string;
  defaultTimezone: string;
  maxConcurrentJobs: number;
  missedRunPolicy: MissedRunPolicy;
  alertOnFailure: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EtlSchedule {
  id: string;
  configId: string;
  agentId: string;
  scheduleName: string;
  cronExpression: string;
  pipelineId?: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  failureCount: number;
  status: ScheduleStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface EtlRunHistory {
  id: string;
  scheduleId: string;
  pipelineId?: string;
  triggerType: TriggerType;
  durationSeconds?: number;
  recordsProcessed: number;
  status: RunStatus;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
