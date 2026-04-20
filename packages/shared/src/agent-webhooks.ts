// Batch 69 — Agent Webhooks & External Integrations

export type WebhookMethod = 'POST' | 'PUT' | 'PATCH';
export type RetryPolicy = 'none' | 'linear' | 'exponential' | 'fixed';
export type DeliveryStatus = 'pending' | 'delivering' | 'delivered' | 'failed' | 'retrying' | 'cancelled';
export type IntegrationType = 'webhook' | 'oauth' | 'api_key' | 'custom';
export type WebhookAction = 'endpoint_create' | 'subscription_add' | 'delivery_send' | 'delivery_retry' | 'integration_connect' | 'integration_revoke' | 'webhook_report';

export interface WebhookEndpoint {
  id: string;
  agentId?: string;
  name: string;
  url: string;
  method: WebhookMethod;
  headers: Record<string, string>;
  secret?: string;
  enabled: boolean;
  retryPolicy: RetryPolicy;
  maxRetries: number;
  timeoutMs: number;
  metadata: Record<string, unknown>;
}

export interface WebhookSubscription {
  id: string;
  endpointId: string;
  eventType: string;
  filter: Record<string, unknown>;
  active: boolean;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: DeliveryStatus;
  attempt: number;
  responseCode?: number;
  errorMessage?: string;
  nextRetryAt?: string;
  deliveredAt?: string;
}

export interface ExternalIntegration {
  id: string;
  agentId?: string;
  provider: string;
  integrationType: IntegrationType;
  config: Record<string, unknown>;
  status: 'active' | 'paused' | 'revoked' | 'expired';
  lastUsedAt?: string;
}

export interface WebhookLog {
  id: string;
  deliveryId: string;
  attempt: number;
  requestUrl: string;
  responseCode?: number;
  durationMs?: number;
  error?: string;
}

export const WEBHOOK_METHODS: WebhookMethod[] = ['POST', 'PUT', 'PATCH'];
export const RETRY_POLICIES: RetryPolicy[] = ['none', 'linear', 'exponential', 'fixed'];
export const DELIVERY_STATUSES: DeliveryStatus[] = ['pending', 'delivering', 'delivered', 'failed', 'retrying', 'cancelled'];
export const INTEGRATION_TYPES: IntegrationType[] = ['webhook', 'oauth', 'api_key', 'custom'];

export function isRetriableStatus(status: DeliveryStatus): boolean {
  return status === 'failed' || status === 'retrying';
}
export function calculateRetryDelay(policy: RetryPolicy, attempt: number, baseMs: number = 1000): number {
  if (policy === 'none') return 0;
  if (policy === 'fixed') return baseMs;
  if (policy === 'linear') return baseMs * attempt;
  return baseMs * Math.pow(2, attempt);
}
export function isActiveIntegration(status: string): boolean {
  return status === 'active';
}
export function generateWebhookSignature(payload: string, secret: string): string {
  return `sha256=${secret}-${payload.length}`;
}
