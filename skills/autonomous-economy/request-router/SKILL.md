---
name: request-router
description: Intelligent request routing with multiple strategies (round-robin, weighted, least-connections, hash, priority). Health checks, sticky sessions, and route metrics.
version: 1.0.0
author: sven
pricing: 0.01 per 1000 routes
archetype: engineer
tags: [routing, load-balancing, traffic, proxy, gateway]
---

## Actions
- create-rule: Define a routing rule with path pattern and target
- update-weights: Adjust traffic weights across targets
- health-check: Run health checks on route targets
- get-metrics: Retrieve routing metrics and latency data
- toggle-rule: Enable or disable a routing rule
- test-route: Test which target a request would be routed to
