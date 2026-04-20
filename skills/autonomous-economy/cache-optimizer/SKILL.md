---
name: cache-optimizer
version: 1.0.0
description: Intelligent cache management and optimization for performance
category: observability
pricing: { model: per_use, base_cost: 2.99 }
archetype: analyst
---

# Cache Optimizer

Optimizes cache performance through intelligent eviction policies, hit rate analysis, and memory management recommendations.

## Actions

- **analyze-cache**: Analyze current cache performance and hit rates
- **optimize-ttl**: Recommend optimal TTL values based on access patterns
- **warm-cache**: Pre-populate cache with frequently accessed data
- **evict-stale**: Remove stale or low-value cache entries
- **resize-cache**: Recommend memory allocation changes
- **generate-report**: Create cache performance analytics report

## Inputs

- cacheBackend: CacheBackend — redis, memcached, in_memory, hybrid
- maxMemoryMb: number — Maximum memory allocation
- evictionPolicy: EvictionPolicy — lru, lfu, fifo, ttl, random
- analysisWindow: string — Time window for analysis

## Outputs

- analytics: CacheAnalytics — Hit rate, memory usage, eviction stats
- recommendations: string[] — Optimization suggestions
- estimatedImprovement: number — Projected hit rate improvement percentage
