---
name: agent-connection-pool
version: 1.0.0
description: Database and service connection pool management
author: sven-autonomous
pricing:
  base: 0.00
  currency: "47T"
archetype: engineer
---

# Agent Connection Pool

Manages connection pools for databases and services with health monitoring and auto-scaling.

## Actions
- create-pool: Create a new connection pool with size and timeout config
- resize-pool: Adjust min/max connections for a pool
- drain-pool: Gracefully drain and close a connection pool
- view-metrics: Get pool utilization, wait times, and error rates
- health-check: Run health check on pool connections
- list-pools: List all active connection pools

## Inputs
- poolName: Name for the connection pool
- targetType: Backend type (postgresql, redis, mongodb, http, grpc, nats)
- targetHost: Backend host address
- targetPort: Backend port
- minConnections: Minimum pool size
- maxConnections: Maximum pool size
- idleTimeoutSeconds: Idle connection timeout

## Outputs
- poolId: Pool identifier
- metrics: Utilization, wait times, error counts
- activeConnections: Current active connection count
- healthStatus: Pool health status
