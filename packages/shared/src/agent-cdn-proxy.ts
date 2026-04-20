export type CachePolicy = 'aggressive' | 'moderate' | 'conservative' | 'bypass' | 'custom';
export type PurgeType = 'path' | 'prefix' | 'tag' | 'all';

export interface AgentCdnProxyConfig {
  id: string;
  agentId: string;
  cdnName: string;
  originUrl: string;
  cachePolicy: CachePolicy;
  maxCacheSizeMb: number;
  edgeLocations: string[];
  sslEnabled: boolean;
  compressionEnabled: boolean;
  metadata: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCdnCacheEntry {
  id: string;
  configId: string;
  cacheKey: string;
  contentType: string | null;
  sizeBytes: number;
  hitCount: number;
  ttl: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface AgentCdnPurgeRequest {
  id: string;
  configId: string;
  purgePattern: string;
  purgeType: PurgeType;
  status: string;
  entriesPurged: number;
  requestedAt: string;
  completedAt: string | null;
}
