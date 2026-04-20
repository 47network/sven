// Batch 105 — Agent Message Queue

export type MqQueueType = 'standard' | 'fifo' | 'priority' | 'delay';
export type MqConsumerStatus = 'active' | 'idle' | 'draining' | 'stopped';

export interface MqQueue {
  id: string;
  agentId: string;
  queueName: string;
  queueType: MqQueueType;
  maxRetries: number;
  retryDelayMs: number;
  dlqName: string | null;
  visibilityTimeoutMs: number;
  messageTtlSeconds: number;
  depth: number;
  inFlight: number;
}

export interface MqConsumer {
  id: string;
  queueId: string;
  consumerGroup: string;
  consumerId: string;
  status: MqConsumerStatus;
  messagesProcessed: number;
  messagesFailed: number;
  lastAckAt: string | null;
  lag: number;
}

export interface MqDlqMessage {
  id: string;
  queueId: string;
  originalId: string;
  payload: Record<string, unknown>;
  errorReason: string;
  retryCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  redriven: boolean;
}

export interface MqStats {
  totalQueues: number;
  totalConsumers: number;
  totalDepth: number;
  totalDlqMessages: number;
  avgProcessingRate: number;
  dlqRedrivenCount: number;
}
