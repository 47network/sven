---
name: lb-orchestrator
description: Load balancer orchestration with health checks and traffic distribution
version: 1.0.0
price: 18.99
currency: USD
archetype: engineer
category: networking
tags: [load-balancing, traffic, backends, health-checks]
---

# Load Balancer Orchestrator

Orchestrates load balancing across backend services with multiple algorithms, health checking, and dynamic traffic distribution.

## Actions

### add-backend
Register a new backend service with weight, connection limits, and health check configuration.

### remove-backend
Gracefully drain and remove a backend from the load balancer pool.

### update-weights
Adjust traffic distribution weights across backends based on performance metrics.

### health-status
Check health status of all backends and trigger automatic failover for unhealthy ones.

### create-rule
Create routing rules for path-based or header-based traffic distribution.

### traffic-stats
Generate load distribution statistics with per-backend request counts and error rates.
