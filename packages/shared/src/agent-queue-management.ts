// Batch 79 — Agent Queue Management shared types

export type QueueType = 'fifo' | 'lifo' | 'priority' | 'delayed' | 'dead_letter';
export type QueueStatus = 'active' | 'paused' | 'draining' | 'archived';
export type QueueMessageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'delayed' | 'dead_letter';
export type QueueConsumerStatus = 'active' | 'idle' | 'busy' | 'disconnected';
export type QueueScheduleStatus = 'enabled' | 'disabled';

export interface TaskQueue {
  id: string;
  name: string;
  description?: string;
  queueType: QueueType;
  status: QueueStatus;
  maxSize: number;
  maxRetries: number;
  retryDelayMs: number;
  visibilityTimeoutMs: number;
  dlqQueueId?: string;
  consumerCount: number;
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  ownerAgentId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface QueueMessage {
  id: string;
  queueId: string;
  body: Record<string, unknown>;
  priority: number;
  status: QueueMessageStatus;
  attempts: number;
  maxAttempts: number;
  delayUntil?: string;
  visibleAt: string;
  lockedBy?: string;
  lockedAt?: string;
  completedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  result?: Record<string, unknown>;
  traceId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface QueueConsumer {
  id: string;
  queueId: string;
  agentId: string;
  status: QueueConsumerStatus;
  batchSize: number;
  pollIntervalMs: number;
  messagesProcessed: number;
  messagesFailed: number;
  lastHeartbeatAt: string;
  lastMessageAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface QueueSchedule {
  id: string;
  queueId: string;
  name: string;
  cronExpression: string;
  messageTemplate: Record<string, unknown>;
  enabled: boolean;
  lastTriggeredAt?: string;
  nextTriggerAt?: string;
  triggerCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface QueueMetrics {
  id: string;
  queueId: string;
  periodStart: string;
  periodEnd: string;
  enqueuedCount: number;
  dequeuedCount: number;
  completedCount: number;
  failedCount: number;
  avgProcessingMs: number;
  p95ProcessingMs: number;
  p99ProcessingMs: number;
  dlqCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isQueueFull(queue: Pick<TaskQueue, 'pendingCount' | 'processingCount' | 'maxSize'>): boolean {
  return (queue.pendingCount + queue.processingCount) >= queue.maxSize;
}

export function shouldRetry(msg: Pick<QueueMessage, 'attempts' | 'maxAttempts'>): boolean {
  return msg.attempts < msg.maxAttempts;
}

export function queueThroughput(metrics: Pick<QueueMetrics, 'completedCount' | 'periodStart' | 'periodEnd'>): number {
  const durationMs = new Date(metrics.periodEnd).getTime() - new Date(metrics.periodStart).getTime();
  return durationMs > 0 ? (metrics.completedCount / durationMs) * 1000 : 0;
}
