export interface CacheStore {
  id: string;
  agentId: string;
  name: string;
  storeType: CacheStoreType;
  connectionConfig: Record<string, unknown>;
  maxMemoryMb: number;
  evictionPolicy: CacheEvictionPolicy;
  status: CacheStoreStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CachePolicy {
  id: string;
  storeId: string;
  keyPattern: string;
  ttlSeconds: number;
  invalidationStrategy: CacheInvalidationStrategy;
  compress: boolean;
  priority: number;
  createdAt: string;
}

export interface CacheMetrics {
  id: string;
  storeId: string;
  periodStart: string;
  periodEnd: string;
  hits: number;
  misses: number;
  evictions: number;
  memoryUsedMb: number;
  avgLatencyMs: number;
  createdAt: string;
}

export type CacheStoreType = 'redis' | 'memcached' | 'in_memory' | 'distributed' | 'cdn_edge' | 'sqlite' | 'lru' | 'tiered';
export type CacheEvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl' | 'random' | 'none';
export type CacheStoreStatus = 'offline' | 'warming' | 'ready' | 'degraded' | 'error' | 'draining';
export type CacheInvalidationStrategy = 'ttl' | 'event' | 'manual' | 'write_through' | 'write_behind';
