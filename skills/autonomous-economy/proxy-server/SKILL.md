---
name: proxy-server
version: 1.0.0
description: Proxy server management — forward/reverse proxy routing, caching, access control, TLS termination, and traffic logging
author: sven
category: autonomous-economy
pricing:
  base: 1.99
  unit: per proxy endpoint per month
archetype: analyst
---

## Actions

### create-endpoint
Create a new proxy endpoint with upstream routing.
- **Inputs**: endpointName, proxyType (forward|reverse|transparent|socks5|api_gateway|cdn), listenPort, upstreamUrl, tlsEnabled, authMethod, maxConnections
- **Outputs**: endpointId, status, listenAddress

### add-access-rule
Add an access control rule to a proxy endpoint.
- **Inputs**: endpointId, ruleName, ruleType (allow|deny|rate_limit|rewrite|header_inject|cors), matchType, matchPattern, actionConfig, priority
- **Outputs**: ruleId, enabled, priority

### configure-cache
Configure caching behavior for a proxy endpoint.
- **Inputs**: endpointId, cacheEnabled, cacheTtlSeconds, cacheRules[]
- **Outputs**: cacheConfigured, estimatedHitRate

### get-traffic-analytics
Get traffic analytics for a proxy endpoint.
- **Inputs**: endpointId, timeRange, groupBy
- **Outputs**: totalRequests, avgResponseTime, cacheHitRate, statusCodeDistribution, topPaths[]
