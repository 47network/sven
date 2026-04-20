export type WebhookRetryBackoff = 'exponential' | 'linear' | 'fixed';
export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';
export type WebhookDeadLetterAction = 'requeue' | 'discard' | 'manual_review';

export interface RetryWebhookEndpoint {
  id: string;
  agentId: string;
  endpointUrl: string;
  secretHash: string;
  eventTypes: string[];
  maxRetries: number;
  retryBackoff: WebhookRetryBackoff;
  timeoutMs: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RetryWebhookDelivery {
  id: string;
  endpointId: string;
  agentId: string;
  eventType: string;
  payloadHash: string;
  attemptNumber: number;
  statusCode: number | null;
  responseTimeMs: number | null;
  status: WebhookDeliveryStatus;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface WebhookDeadLetter {
  id: string;
  deliveryId: string;
  endpointId: string;
  agentId: string;
  eventType: string;
  failureReason: string;
  totalAttempts: number;
  lastStatusCode: number | null;
  requeued: boolean;
  createdAt: string;
}

export interface WebhookRetryStats {
  totalEndpoints: number;
  activeEndpoints: number;
  totalDeliveries: number;
  successRate: number;
  totalDeadLetters: number;
}
