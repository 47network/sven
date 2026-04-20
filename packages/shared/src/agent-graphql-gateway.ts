// Batch 104 — Agent GraphQL Gateway

export type GqlSchemaStatus = 'active' | 'deprecated' | 'draft';
export type GqlOperationType = 'query' | 'mutation' | 'subscription';
export type GqlCacheScope = 'public' | 'private' | 'no-cache';

export interface GqlSchema {
  id: string;
  agentId: string;
  serviceName: string;
  schemaSdl: string;
  version: number;
  status: GqlSchemaStatus;
  federated: boolean;
  breakingChanges: Array<{ type: string; description: string }>;
  publishedAt: string;
}

export interface GqlOperation {
  id: string;
  agentId: string;
  operationName: string;
  operationType: GqlOperationType;
  documentHash: string;
  avgDurationMs: number;
  p99DurationMs: number;
  callCount: number;
  errorCount: number;
  lastSeenAt: string;
}

export interface GqlCacheRule {
  id: string;
  agentId: string;
  typeName: string;
  fieldName: string | null;
  maxAgeSeconds: number;
  scope: GqlCacheScope;
  staleTtl: number;
  enabled: boolean;
  hitCount: number;
  missCount: number;
}

export interface GqlGatewayStats {
  totalSchemas: number;
  federatedServices: number;
  totalOperations: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  errorRate: number;
}
