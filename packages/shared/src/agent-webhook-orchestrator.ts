export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';
export type SignatureAlgorithm = 'hmac-sha256' | 'hmac-sha512' | 'ed25519' | 'none';
export type WebhookEventFilter = 'all' | 'include' | 'exclude';
export type DeliveryPriority = 'low' | 'normal' | 'high' | 'critical';

export interface WebhookOrchestratorConfig {
  id: string;
  agentId: string;
  maxRetries: number;
  retryDelayMs: number;
  signatureAlgorithm: SignatureAlgorithm;
  deliveryTimeoutMs: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEndpoint {
  id: string;
  configId: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  headers: Record<string, string>;
  active: boolean;
  successCount: number;
  failureCount: number;
  lastDeliveryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  responseBody: string | null;
  attemptCount: number;
  status: WebhookDeliveryStatus;
  nextRetryAt: Date | null;
  createdAt: Date;
  deliveredAt: Date | null;
}
