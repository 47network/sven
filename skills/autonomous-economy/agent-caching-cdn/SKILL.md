---
skill: agent-caching-cdn
name: Agent Caching & CDN
description: Cache policy management, CDN distribution, entry invalidation, purge requests, and cache analytics for agent content delivery
version: 1.0.0
category: infrastructure
pricing:
  model: per_action
  base_cost: 0.50
---

# Agent Caching & CDN

Manage cache policies, CDN distributions, cache entries, purge requests, and analytics.

## Actions

### policy_create
Create a cache policy with type, TTL, eviction strategy, and size limits.

### entry_set
Store a cache entry with key, value hash, and expiration.

### entry_invalidate
Invalidate cache entries by key, pattern, or tag.

### cdn_deploy
Deploy a CDN distribution with origin URL, provider, and SSL configuration.

### purge_request
Submit a cache purge request by pattern, key, or full purge.

### analytics_query
Query cache analytics for hit ratios, latency, and bytes served over a period.

### cache_report
Generate a comprehensive cache health report with utilization and performance metrics.
