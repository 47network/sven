export type OriginType = 'storage' | 'api' | 'compute' | 'external' | 'mirror';

export type OriginStatus = 'active' | 'inactive' | 'degraded' | 'maintenance';

export type CacheStatus = 'fresh' | 'stale' | 'revalidating' | 'purged';

export type PurgeType = 'path' | 'prefix' | 'tag' | 'origin' | 'all';

export type RequestType = 'hit' | 'miss' | 'bypass' | 'error' | 'redirect';

export interface CdnOrigin {
  id: string;
  name: string;
  originType: OriginType;
  baseUrl: string;
  status: OriginStatus;
  region?: string;
  priority: number;
  healthCheckUrl?: string;
  lastHealthCheck?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CdnAsset {
  id: string;
  originId: string;
  assetPath: string;
  contentType: string;
  sizeBytes: number;
  checksum?: string;
  cacheControl: string;
  ttlSeconds: number;
  version: number;
  isImmutable: boolean;
  accessCount: number;
  lastAccessed?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CdnCacheEntry {
  id: string;
  assetId: string;
  edgeLocation: string;
  cachedAt: string;
  expiresAt: string;
  hitCount: number;
  sizeBytes: number;
  status: CacheStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CdnPurgeRequest {
  id: string;
  requestType: PurgeType;
  pattern: string;
  status: string;
  affectedCount: number;
  requestedBy?: string;
  reason?: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CdnAnalyticsEntry {
  id: string;
  assetId?: string;
  edgeLocation?: string;
  requestType: RequestType;
  responseTimeMs?: number;
  bytesTransferred: number;
  clientRegion?: string;
  userAgent?: string;
  statusCode?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isCacheFresh(entry: CdnCacheEntry): boolean {
  return entry.status === 'fresh' && new Date(entry.expiresAt) > new Date();
}

export function cacheHitRate(analytics: CdnAnalyticsEntry[]): number {
  if (analytics.length === 0) return 0;
  return (analytics.filter(a => a.requestType === 'hit').length / analytics.length) * 100;
}

export function totalBandwidth(analytics: CdnAnalyticsEntry[]): number {
  return analytics.reduce((sum, a) => sum + a.bytesTransferred, 0);
}
