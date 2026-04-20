export type EnrichmentSourceType = 'api' | 'database' | 'file' | 'cache' | 'computed' | 'external';
export type EnrichmentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial';
export type CacheStrategy = 'none' | 'ttl' | 'lru' | 'persistent';
export type MatchStrategy = 'exact' | 'fuzzy' | 'regex' | 'semantic';

export interface DataEnricherConfig {
  id: string;
  agentId: string;
  enrichmentSources: string[];
  cacheTtlSeconds: number;
  batchSize: number;
  rateLimitPerMin: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnrichmentJob {
  id: string;
  configId: string;
  agentId: string;
  sourceType: EnrichmentSourceType;
  recordsTotal: number;
  recordsEnriched: number;
  recordsFailed: number;
  enrichmentFields: string[];
  status: EnrichmentStatus;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface EnrichmentSource {
  id: string;
  configId: string;
  sourceName: string;
  sourceType: EnrichmentSourceType;
  endpointUrl?: string;
  authConfig: Record<string, unknown>;
  fieldMappings: Record<string, unknown>;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
