export type IntegrationStatus = 'inactive' | 'active' | 'error' | 'suspended';
export type AuthType = 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom';
export type LogDirection = 'inbound' | 'outbound';
export type RetryStrategy = 'exponential' | 'linear' | 'fixed' | 'none';

export interface IntegrationConnectorConfig {
  id: string;
  agentId: string;
  maxConnections: number;
  retryPolicy: Record<string, unknown>;
  timeoutMs: number;
  authType: AuthType;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentIntegration {
  id: string;
  configId: string;
  name: string;
  provider: string;
  endpointUrl: string;
  authCredentials: Record<string, unknown>;
  status: IntegrationStatus;
  lastHealthCheck: Date | null;
  requestCount: number;
  errorCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationLog {
  id: string;
  integrationId: string;
  direction: LogDirection;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  requestBody: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
  latencyMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
}
