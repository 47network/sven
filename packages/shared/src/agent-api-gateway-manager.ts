// Batch 241: API Gateway Manager types

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type ApiConsumerStatus = 'active' | 'suspended' | 'revoked';

export interface AgentApiRoute {
  id: string;
  agentId: string;
  routePath: string;
  method: HttpMethod;
  upstreamUrl: string;
  version: string;
  authRequired: boolean;
  rateLimitRps: number | null;
  timeoutMs: number | null;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentApiConsumer {
  id: string;
  agentId: string;
  consumerName: string;
  apiKeyHash: string;
  allowedRoutes: string[];
  rateLimitRps: number;
  quotaDaily: number;
  status: ApiConsumerStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentApiAnalytics {
  id: string;
  routeId: string;
  consumerId: string | null;
  timestamp: string;
  responseTimeMs: number;
  statusCode: number;
  requestSizeBytes: number;
  responseSizeBytes: number;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}
