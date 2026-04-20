export interface WebhookRouterConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  endpoints: Record<string, unknown>[];
  routingRules: Record<string, unknown>[];
  retryPolicy: Record<string, unknown>;
  signatureVerification: Record<string, unknown>;
  deliveryLogRetentionDays: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface WebhookDelivery {
  webhookId: string;
  endpoint: string;
  payload: Record<string, unknown>;
  statusCode: number;
  attempts: number;
  deliveredAt: string;
}
export interface WebhookEndpoint {
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  failureCount: number;
}
