// Batch 72 — Agent Caching & CDN

export type CacheType = 'memory' | 'disk' | 'distributed' | 'cdn' | 'edge';
export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl' | 'random';
export type CdnProvider = 'internal' | 'cloudflare' | 'aws_cloudfront' | 'bunny' | 'fastly';
export type PurgeType = 'all' | 'pattern' | 'key' | 'tag';
export type CachingAction = 'policy_create' | 'entry_set' | 'entry_invalidate' | 'cdn_deploy' | 'purge_request' | 'analytics_query' | 'cache_report';

export interface CachePolicy {
  id: string;
  agentId?: string;
  name: string;
  cacheType: CacheType;
  ttlSeconds: number;
  maxSizeBytes: number;
  eviction: EvictionPolicy;
  enabled: boolean;
  patterns: string[];
}

export interface CacheEntry {
  id: string;
  policyId: string;
  cacheKey: string;
  valueHash: string;
  sizeBytes: number;
  hitCount: number;
  missCount: number;
  expiresAt?: string;
}

export interface CdnDistribution {
  id: string;
  agentId?: string;
  name: string;
  originUrl: string;
  cdnUrl?: string;
  provider: CdnProvider;
  status: 'active' | 'deploying' | 'suspended' | 'deleted';
  sslEnabled: boolean;
  compression: boolean;
}

export interface CachePurgeRequest {
  id: string;
  policyId?: string;
  distributionId?: string;
  purgeType: PurgeType;
  pattern?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  purgedCount: number;
}

export interface CacheAnalytics {
  id: string;
  policyId: string;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatio: number;
  avgLatencyMs: number;
  bytesServed: number;
}

export const CACHE_TYPES: CacheType[] = ['memory', 'disk', 'distributed', 'cdn', 'edge'];
export const EVICTION_POLICIES: EvictionPolicy[] = ['lru', 'lfu', 'fifo', 'ttl', 'random'];
export const CDN_PROVIDERS: CdnProvider[] = ['internal', 'cloudflare', 'aws_cloudfront', 'bunny', 'fastly'];
export const PURGE_TYPES: PurgeType[] = ['all', 'pattern', 'key', 'tag'];

export function calculateHitRatio(hits: number, misses: number): number {
  const total = hits + misses;
  return total > 0 ? Math.round((hits / total) * 10000) / 10000 : 0;
}
export function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}
export function estimateCacheSize(entries: Array<{ sizeBytes: number }>): number {
  return entries.reduce((sum, e) => sum + e.sizeBytes, 0);
}
export function shouldEvict(currentSize: number, maxSize: number): boolean {
  return maxSize > 0 && currentSize >= maxSize;
}
