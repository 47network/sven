// Batch 354: Cache Warmer types

export type CacheBackend = 'redis' | 'memcached' | 'in_memory' | 'distributed';
export type WarmupStrategy = 'lazy' | 'eager' | 'predictive' | 'scheduled';
export type CacheEntryStatus = 'warm' | 'cold' | 'expired' | 'evicted';
export type EvictionPolicy = 'lru' | 'lfu' | 'ttl' | 'fifo';

export interface CacheWarmerConfig {
  id: string;
  agentId: string;
  name: string;
  cacheBackend: CacheBackend;
  warmupStrategy: WarmupStrategy;
  ttlSeconds: number;
  maxEntries: number;
  priority: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CacheEntry {
  id: string;
  configId: string;
  cacheKey: string;
  cacheValue: unknown;
  hitCount: number;
  missCount: number;
  lastAccessedAt?: string;
  expiresAt?: string;
  warmedAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CacheStats {
  id: string;
  configId: string;
  periodStart: string;
  periodEnd: string;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  evictions: number;
  warmupDurationMs?: number;
  entriesWarmed: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}
