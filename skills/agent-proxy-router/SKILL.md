---
name: agent-proxy-router
version: 1.0.0
description: Reverse proxy and traffic routing — upstream management, load balancing, access logging
category: networking
pricing:
  base: 2.99
  currency: USD
  per: route_configuration
tags: [proxy, routing, load-balancing, reverse-proxy, traffic, cors]
---

# Agent Proxy Router

Manages reverse proxy upstreams, routing rules, rate limiting, CORS, and access logging.

## Actions
- **create-upstream**: Register upstream service with health checks
- **add-route**: Configure routing rules (prefix, exact, regex, canary)
- **configure-rate-limit**: Set rate limiting per route or upstream
- **analyze-traffic**: Review access logs for patterns and anomalies
- **update-weights**: Adjust traffic distribution across upstreams
- **toggle-maintenance**: Enable/disable maintenance mode per upstream
