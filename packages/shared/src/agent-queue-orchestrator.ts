export type QueueBackend = 'nats' | 'redis' | 'rabbitmq' | 'kafka' | 'sqs';
export type QueueStatus = 'active' | 'paused' | 'draining' | 'deleted';

export interface QueueOrchestratorConfig {
  id: string;
  agentId: string;
  defaultBackend: QueueBackend;
  maxRetries: number;
  deadLetterEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedQueue {
  id: string;
  configId: string;
  queueName: string;
  backend: QueueBackend;
  consumerCount: number;
  messageCount: number;
  status: QueueStatus;
  createdAt: string;
}

export interface QueueMetrics {
  id: string;
  queueId: string;
  enqueued: number;
  dequeued: number;
  failed: number;
  deadLettered: number;
  avgLatencyMs?: number;
  recordedAt: string;
}
