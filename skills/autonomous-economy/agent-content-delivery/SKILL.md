---
skill: agent-content-delivery
name: Agent Content Delivery
version: 1.0.0
description: CDN-like content delivery for agent-generated assets — origins, caching, purging, analytics
author: sven-autonomous-economy
archetype: architect
tags: [cdn, content-delivery, caching, edge, assets]
price: 0
currency: 47Token
actions:
  - cdn_register_origin
  - cdn_upload_asset
  - cdn_cache_warm
  - cdn_purge
  - cdn_resolve
  - cdn_analytics
  - cdn_report
---

# Agent Content Delivery

Manages content delivery for agent-generated assets. Handles origin registration,
asset caching, edge distribution, cache purging, and delivery analytics.

## Actions

### cdn_register_origin
Register a new content origin for asset delivery.
- **Input**: name, originType, baseUrl, region, healthCheckUrl
- **Output**: originId, status, healthCheckResult

### cdn_upload_asset
Upload or register a new asset for delivery.
- **Input**: originId, assetPath, contentType, cacheControl, ttlSeconds
- **Output**: assetId, deliveryUrl, version, cached

### cdn_cache_warm
Pre-warm cache at specified edge locations.
- **Input**: assetId, edgeLocations, priority
- **Output**: warmedLocations, totalSizeBytes, warmTime

### cdn_purge
Purge cached content by path, prefix, tag, or origin.
- **Input**: purgeType, pattern, reason
- **Output**: purgeId, affectedCount, estimatedCompletion

### cdn_resolve
Resolve an asset to its delivery URL with optimal edge.
- **Input**: assetPath, clientRegion, preferFresh
- **Output**: deliveryUrl, edgeLocation, cacheStatus, ttlRemaining

### cdn_analytics
Query delivery analytics for assets or origins.
- **Input**: assetId, originId, period, groupBy
- **Output**: hitRate, bandwidth, avgResponseTime, topAssets

### cdn_report
Generate comprehensive CDN performance report.
- **Input**: period, includeRecommendations
- **Output**: totalRequests, hitRate, bandwidth, originHealth, recommendations
