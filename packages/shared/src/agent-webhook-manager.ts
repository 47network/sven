// Batch 176: Agent Webhook Manager types

export type WebhookDirection = 'inbound' | 'outbound' | 'bidirectional';
export type WebhookHttpMethod = 'POST' | 'PUT' | 'PATCH' | 'GET' | 'DELETE';
export type WebhookDeliveryStatus = 'pending' | 'delivering' | 'delivered' | 'failed' | 'retrying' | 'expired';

export interface WebhookRetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
}

export interface WebhookEndpoint {
  id: string;
  agentId: string;
  endpointName: string;
  direction: WebhookDirection;
  url: string;
  httpMethod: WebhookHttpMethod;
  secretKey: string | null;
  signatureHeader: string;
  contentType: string;
  eventTypes: string[];
  transformTemplate: Record<string, unknown> | null;
  retryPolicy: WebhookRetryPolicy;
  rateLimitPerMin: number | null;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  httpStatus: number | null;
  responseBody: string | null;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  deliveredAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface WebhookLog {
  id: string;
  deliveryId: string;
  attemptNumber: number;
  httpStatus: number | null;
  responseBody: string | null;
  durationMs: number;
  errorMessage: string | null;
  headersSent: Record<string, unknown> | null;
  attemptedAt: string;
}
