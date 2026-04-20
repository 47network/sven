// Batch 45 — Agent Task Queue & Scheduling shared types

export type QueueItemStatus =
  | 'queued'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'deferred'
  | 'expired';

export type ScheduleFrequency =
  | 'once'
  | 'minutely'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'custom_cron';

export type DependencyType =
  | 'blocks'
  | 'suggests'
  | 'triggers';

export type AssignmentStrategy =
  | 'best_fit'
  | 'round_robin'
  | 'least_loaded'
  | 'reputation_weighted'
  | 'random'
  | 'manual';

export type ExecutionLogEvent =
  | 'queued'
  | 'assigned'
  | 'accepted'
  | 'rejected'
  | 'started'
  | 'progress'
  | 'completed'
  | 'failed'
  | 'retried'
  | 'cancelled'
  | 'deferred'
  | 'expired';

export interface TaskQueueItem {
  id: string;
  taskType: string;
  priority: number;
  status: QueueItemStatus;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  assignedAgentId?: string;
  requiredSkills: string[];
  maxRetries: number;
  retryCount: number;
  scheduledAt?: string;
  deadlineAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskSchedule {
  id: string;
  name: string;
  taskType: string;
  cronExpression: string;
  payloadTemplate: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
  maxRuns?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignment {
  id: string;
  queueItemId: string;
  agentId: string;
  assignedAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
  reason?: string;
  score: number;
}

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnId: string;
  depType: DependencyType;
  createdAt: string;
}

export interface TaskExecutionLog {
  id: string;
  queueItemId: string;
  agentId?: string;
  eventType: ExecutionLogEvent;
  details: Record<string, unknown>;
  createdAt: string;
}

export const DEFAULT_PRIORITY = 50;
export const MAX_PRIORITY = 100;
export const MIN_PRIORITY = 0;
export const DEFAULT_MAX_RETRIES = 3;
export const QUEUE_POLL_INTERVAL_MS = 5_000;
export const ASSIGNMENT_TIMEOUT_MS = 30_000;

export const PRIORITY_LABELS: Record<string, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
  background: 10,
};

export const STATUS_ORDER: QueueItemStatus[] = [
  'queued',
  'assigned',
  'in_progress',
  'completed',
];

export function canRetry(item: Pick<TaskQueueItem, 'retryCount' | 'maxRetries' | 'status'>): boolean {
  return item.status === 'failed' && item.retryCount < item.maxRetries;
}

export function isTerminal(status: QueueItemStatus): boolean {
  return ['completed', 'failed', 'cancelled', 'expired'].includes(status);
}

export function calculateAssignmentScore(
  skillMatch: number,
  reputation: number,
  availability: number,
): number {
  return skillMatch * 0.4 + reputation * 0.35 + availability * 0.25;
}

export function isPastDeadline(item: Pick<TaskQueueItem, 'deadlineAt'>): boolean {
  if (!item.deadlineAt) return false;
  return new Date(item.deadlineAt).getTime() < Date.now();
}
