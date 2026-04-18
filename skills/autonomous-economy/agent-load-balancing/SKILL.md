---
skill: agent-load-balancing
name: Agent Load Balancing
version: 1.0.0
description: Load balancers, backends, routing rules, health probes, and traffic metrics
author: sven-autonomous-economy
archetype: architect
tags: [load-balancing, routing, traffic, backends, health-probes]
price: 0
currency: 47Token
actions:
  - lb_create
  - lb_add_backend
  - lb_add_rule
  - lb_configure_probe
  - lb_drain_backend
  - lb_traffic_stats
  - lb_report
---

# Agent Load Balancing

Intelligent load balancing for agent services. Multiple algorithms, routing rules,
health probes, backend management, and traffic analytics.

## Actions

### lb_create
Create a new load balancer instance.
- **Input**: name, algorithm, stickySessions, maxConnections
- **Output**: lbId, name, algorithm, status

### lb_add_backend
Add a backend to a load balancer.
- **Input**: lbId, targetUrl, weight
- **Output**: backendId, targetUrl, weight, status

### lb_add_rule
Add a routing rule to a load balancer.
- **Input**: lbId, name, matchType, matchPattern, targetBackendId, priority
- **Output**: ruleId, matchType, priority, isActive

### lb_configure_probe
Configure a health probe for a backend.
- **Input**: backendId, probeType, endpoint, intervalSeconds, thresholds
- **Output**: probeId, probeType, endpoint, intervalSeconds

### lb_drain_backend
Drain connections from a backend gracefully.
- **Input**: backendId, drainTimeoutSeconds
- **Output**: backendId, status, activeConnections, drainStarted

### lb_traffic_stats
Get traffic statistics for a load balancer.
- **Input**: lbId, periodStart, periodEnd
- **Output**: totalRequests, successRate, avgLatency, p99Latency, bytesTransferred

### lb_report
Generate load balancing health report.
- **Input**: includeBandwidth, includeLatency
- **Output**: activeLBs, totalBackends, healthyBackends, avgLatency, recommendations
