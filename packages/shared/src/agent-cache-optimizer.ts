export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl' | 'random';
export type CacheBackend = 'redis' | 'memcached' | 'in_memory' | 'hybrid';

export interface CacheOptimizerConfig {
  id: string;
  agentId: string;
  cacheBackend: CacheBackend;
  maxMemoryMb: number;
  evictionPolicy: EvictionPolicy;
  ttlDefaultSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface CacheEntry {
  id: string;
  configId: string;
  cacheKey: string;
  valueSizeBytes: number;
  hitCount: number;
  missCount: number;
  ttlSeconds: number;
  lastAccessedAt: string;
  createdAt: string;
}

export interface CacheAnalytics {
  id: string;
  configId: string;
  periodStart: string;
  periodEnd: string;
  hitRate: number;
  memoryUsageMb: number;
  evictionCount: number;
  recommendations: unknown[];
}
