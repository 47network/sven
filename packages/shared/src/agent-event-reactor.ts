export type ReactionType = 'handler' | 'webhook' | 'task' | 'notification' | 'chain' | 'transform';
export type ReactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter' | 'retrying';
export type EventPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';
export type FilterMode = 'include' | 'exclude' | 'transform' | 'sample';

export interface EventReactorConfig {
  id: string;
  agentId: string;
  maxReactionsPerMinute: number;
  dedupWindowSeconds: number;
  deadLetterEnabled: boolean;
  batchSize: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventSubscription {
  id: string;
  configId: string;
  agentId: string;
  eventPattern: string;
  reactionType: ReactionType;
  filterExpression?: Record<string, unknown>;
  priority: number;
  active: boolean;
  invocationCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface EventReaction {
  id: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  reactionStatus: ReactionStatus;
  inputData: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  durationMs?: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
