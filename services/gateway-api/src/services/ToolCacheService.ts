import { getPool } from '../db/pool.js';
import crypto from 'crypto';

/**
 * Tool Cache Service
 * Provides TTL-based caching for read-only tool calls using cache_config table
 */

const pool = getPool();

interface CacheConfig {
  toolName: string;
  ttlSeconds: number;
  maxEntrySizeBytes: number;
  strategy: string;
  invalidateOnWriteScope: boolean;
}

interface CacheEntry {
  key: string;
  value: any;
  expiresAt: number;
}

// In-memory cache with TTL expiration
const memoryCache = new Map<string, CacheEntry>();

/**
 * Generate cache key from tool name and inputs
 */
function generateCacheKey(toolName: string, inputs: any): string {
  const inputsJson = JSON.stringify(inputs);
  const hash = crypto.createHash('sha256').update(inputsJson).digest('hex');
  return `${toolName}:${hash}`;
}

/**
 * Get cache configuration for tool
 */
async function getCacheConfig(toolName: string): Promise<CacheConfig | null> {
  try {
    const result = await pool.query(
      `SELECT tool_name, ttl_seconds, max_entry_size_bytes, cache_strategy,
              invalidate_on_write_scope
       FROM cache_config
       WHERE tool_name = $1 AND cache_enabled = TRUE`,
      [toolName]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const r = result.rows[0];
    return {
      toolName: r.tool_name,
      ttlSeconds: r.ttl_seconds,
      maxEntrySizeBytes: r.max_entry_size_bytes,
      strategy: r.cache_strategy,
      invalidateOnWriteScope: r.invalidate_on_write_scope,
    };
  } catch (error) {
    console.error('Failed to get cache config for tool:', toolName, error);
    return null;
  }
}

/**
 * Try to get cached result
 */
export async function getCachedToolResult(toolName: string, inputs: any): Promise<any | null> {
  try {
    const config = await getCacheConfig(toolName);
    if (!config) {
      return null;
    }

    const cacheKey = generateCacheKey(toolName, inputs);

    // Check in-memory cache first
    const memEntry = memoryCache.get(cacheKey);
    if (memEntry) {
      if (memEntry.expiresAt > Date.now()) {
        // Record hit
        await recordCacheHit(toolName, cacheKey);
        return memEntry.value;
      } else {
        // Expired, remove
        memoryCache.delete(cacheKey);
      }
    }

    // Check database cache (for persistent cache)
    const dbResult = await pool.query(
      `SELECT cached_output, expires_at FROM tool_cache
       WHERE tool_name = $1 AND cache_key = $2
       AND expires_at > CURRENT_TIMESTAMP`,
      [toolName, cacheKey]
    );

    if (dbResult.rows.length > 0) {
      const cachedValue = JSON.parse(dbResult.rows[0].cached_output);
      // Populate memory cache
      memoryCache.set(cacheKey, {
        key: cacheKey,
        value: cachedValue,
        expiresAt: new Date(dbResult.rows[0].expires_at).getTime(),
      });

      // Record hit
      await recordCacheHit(toolName, cacheKey);
      return cachedValue;
    }

    // Cache miss
    await recordCacheMiss(toolName, cacheKey);
    return null;
  } catch (error) {
    console.error('Failed to get cached result for tool:', toolName, error);
    return null;
  }
}

/**
 * Cache tool result with TTL
 */
export async function cacheToolResult(
  toolName: string,
  inputs: any,
  output: any,
  executionTimeMs: number
): Promise<void> {
  try {
    const config = await getCacheConfig(toolName);
    if (!config) {
      return;
    }

    const cacheKey = generateCacheKey(toolName, inputs);
    const outputJson = JSON.stringify(output);
    const outputSize = Buffer.byteLength(outputJson);

    // Skip if output too large
    if (outputSize > config.maxEntrySizeBytes) {
      console.warn(`Cache skipped for ${toolName}: output too large (${outputSize} > ${config.maxEntrySizeBytes})`);
      return;
    }

    const expiresAt = new Date(Date.now() + config.ttlSeconds * 1000);
    const expiresAtMs = expiresAt.getTime();

    // Store in memory cache
    memoryCache.set(cacheKey, {
      key: cacheKey,
      value: output,
      expiresAt: expiresAtMs,
    });

    // Store in database for persistence
    await pool.query(
      `INSERT INTO tool_cache (tool_name, cache_key, cached_output, expires_at, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (tool_name, cache_key) DO UPDATE
       SET cached_output = $3, expires_at = $4, updated_at = CURRENT_TIMESTAMP`,
      [toolName, cacheKey, outputJson, expiresAt]
    );

    // Update cache stats
    await updateCacheStats(toolName, 'write');
  } catch (error) {
    console.error('Failed to cache result for tool:', toolName, error);
  }
}

/**
 * Record cache hit
 */
async function recordCacheHit(toolName: string, cacheKey: string): Promise<void> {
  try {
    const startTime = Date.now();

    // Atomic upsert ensures single-row invariant under concurrent traffic.
    await pool.query(
      `INSERT INTO cache_stats (tool_name, cache_hits, total_requests, sampled_at)
       VALUES ($1, 1, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (tool_name) DO UPDATE
       SET cache_hits = cache_stats.cache_hits + 1,
           total_requests = cache_stats.total_requests + 1,
           sampled_at = CURRENT_TIMESTAMP`,
      [toolName]
    );

    // Log event
    await pool.query(
      `INSERT INTO cache_events (tool_name, cache_key, event_type, timestamp_ms)
       VALUES ($1, $2, 'hit', $3)`,
      [toolName, cacheKey, Date.now() - startTime]
    );
  } catch (error) {
    console.error('Failed to record cache hit for tool:', toolName, error);
  }
}

/**
 * Record cache miss
 */
async function recordCacheMiss(toolName: string, cacheKey: string): Promise<void> {
  try {
    // Atomic upsert ensures single-row invariant under concurrent traffic.
    await pool.query(
      `INSERT INTO cache_stats (tool_name, cache_misses, total_requests, sampled_at)
       VALUES ($1, 1, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (tool_name) DO UPDATE
       SET cache_misses = cache_stats.cache_misses + 1,
           total_requests = cache_stats.total_requests + 1,
           sampled_at = CURRENT_TIMESTAMP`,
      [toolName]
    );

    // Log event
    await pool.query(
      `INSERT INTO cache_events (tool_name, cache_key, event_type, timestamp_ms)
       VALUES ($1, $2, 'miss', $3)`,
      [toolName, cacheKey, 0]
    );
  } catch (error) {
    console.error('Failed to record cache miss for tool:', toolName, error);
  }
}

/**
 * Update cache stats
 */
async function updateCacheStats(
  toolName: string,
  operation: string
): Promise<void> {
  try {
    // Atomic upsert ensures single-row invariant under concurrent traffic.
    await pool.query(
      `INSERT INTO cache_stats (tool_name, sampled_at)
       VALUES ($1, CURRENT_TIMESTAMP)
       ON CONFLICT (tool_name) DO UPDATE
       SET sampled_at = CURRENT_TIMESTAMP`,
      [toolName]
    );

    if (operation === 'write') {
      await recomputeToolCacheSizing(toolName);
    }
  } catch (error) {
    console.error('Failed to update cache stats for tool:', toolName, error);
  }
}

async function recomputeToolCacheSizing(toolName: string): Promise<void> {
  try {
    const sizing = await pool.query(
      `SELECT
         COUNT(*)::INT AS current_entries,
         COALESCE(SUM(octet_length(cached_output)), 0)::BIGINT AS current_size_bytes
       FROM tool_cache
       WHERE tool_name = $1`,
      [toolName]
    );
    const row = sizing.rows[0] || { current_entries: 0, current_size_bytes: 0 };
    await pool.query(
      `UPDATE cache_stats
       SET current_entries = $1,
           current_size_bytes = $2,
           sampled_at = CURRENT_TIMESTAMP
       WHERE tool_name = $3`,
      [Number(row.current_entries || 0), Number(row.current_size_bytes || 0), toolName]
    );
  } catch (error) {
    console.error('Failed to recompute cache sizing for tool:', toolName, error);
  }
}

async function recomputeAllCacheSizing(): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO cache_stats (tool_name, sampled_at)
       SELECT DISTINCT tool_name, CURRENT_TIMESTAMP
       FROM tool_cache
       ON CONFLICT (tool_name) DO UPDATE
       SET sampled_at = CURRENT_TIMESTAMP`
    );

    await pool.query(
      `UPDATE cache_stats
       SET current_entries = 0,
           current_size_bytes = 0,
           sampled_at = CURRENT_TIMESTAMP`
    );

    await pool.query(
      `WITH tool_sizes AS (
         SELECT
           tool_name,
           COUNT(*)::INT AS current_entries,
           COALESCE(SUM(octet_length(cached_output)), 0)::BIGINT AS current_size_bytes
         FROM tool_cache
         GROUP BY tool_name
       )
       UPDATE cache_stats cs
       SET current_entries = ts.current_entries,
           current_size_bytes = ts.current_size_bytes,
           sampled_at = CURRENT_TIMESTAMP
       FROM tool_sizes ts
       WHERE cs.tool_name = ts.tool_name`
    );
  } catch (error) {
    console.error('Failed to recompute all cache sizing stats:', error);
  }
}

/**
 * Invalidate cache for tool (e.g., after write operations)
 */
export async function invalidateToolCache(toolName: string): Promise<void> {
  try {
    // Remove from memory cache
    const keysToDelete: string[] = [];
    for (const [key] of memoryCache.entries()) {
      if (key.startsWith(`${toolName}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => memoryCache.delete(key));

    // Remove from database cache
    await pool.query(
      `DELETE FROM tool_cache WHERE tool_name = $1`,
      [toolName]
    );
    await recomputeToolCacheSizing(toolName);

    console.log('Cache invalidated for tool:', toolName);
  } catch (error) {
    console.error('Failed to invalidate cache for tool:', toolName, error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<
  Array<{
    toolName: string;
    totalRequests: number;
    hits: number;
    misses: number;
    hitRate: number;
    currentSize: number;
    evictions: number;
  }>
> {
  try {
    const result = await pool.query(
      `SELECT tool_name, total_requests, cache_hits, cache_misses,
              CASE WHEN total_requests > 0
                   THEN (cache_hits::FLOAT / total_requests) * 100
                   ELSE 0 END as hit_rate,
              current_size_bytes, evictions
       FROM cache_stats
       ORDER BY total_requests DESC`
    );

    return result.rows.map((r) => ({
      toolName: r.tool_name,
      totalRequests: Number(r.total_requests || 0),
      hits: Number(r.cache_hits || 0),
      misses: Number(r.cache_misses || 0),
      hitRate: Number(r.hit_rate || 0),
      currentSize: Number(r.current_size_bytes || 0),
      evictions: Number(r.evictions || 0),
    }));
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return [];
  }
}

/**
 * Clean expired entries from cache
 */
export async function cleanExpiredCaches(): Promise<number> {
  try {
    // Remove expired from database
    const result = await pool.query(
      `DELETE FROM tool_cache
       WHERE expires_at <= CURRENT_TIMESTAMP`
    );
    await recomputeAllCacheSizing();

    // Remove expired from memory cache
    let memRemoved = 0;
    const keysToDelete: string[] = [];
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.expiresAt <= Date.now()) {
        keysToDelete.push(key);
        memRemoved++;
      }
    }
    keysToDelete.forEach((key) => memoryCache.delete(key));

    const totalRemoved = (result.rowCount || 0) + memRemoved;
    console.log(`Cleaned ${totalRemoved} expired cache entries`);
    return totalRemoved;
  } catch (error) {
    console.error('Failed to clean expired caches:', error);
    return 0;
  }
}
