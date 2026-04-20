export type QueueType = 'standard' | 'fifo' | 'priority' | 'delay' | 'dead_letter';
export type MessageStatus = 'available' | 'processing' | 'completed' | 'failed' | 'dead_letter';

export interface QueueManagerConfig {
  id: string;
  agentId: string;
  maxQueues: number;
  defaultRetentionHours: number;
  rateLimitPerSecond: number;
  dlqEnabled: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentQueue {
  id: string;
  configId: string;
  name: string;
  queueType: QueueType;
  maxSize: number;
  currentSize: number;
  consumers: number;
  visibilityTimeoutSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueMessage {
  id: string;
  queueId: string;
  body: Record<string, unknown>;
  priority: number;
  status: MessageStatus;
  receiveCount: number;
  visibleAt: Date;
  expiresAt?: Date;
  createdAt: Date;
}
