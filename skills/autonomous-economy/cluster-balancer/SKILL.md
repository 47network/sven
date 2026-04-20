---
name: cluster-balancer
description: Load balancing across cluster nodes with health checks, circuit breaking, and sticky sessions
version: 1.0.0
price: 10.99
currency: 47Token
archetype: operator
---
## Actions
- balance: Distribute traffic across healthy nodes
- health-check: Validate node health status
- circuit-break: Enable circuit breaker for failing nodes
- drain: Gracefully remove node from load balancer pool
## Inputs
- algorithm: Balancing algorithm (round_robin, least_conn, weighted)
- endpoints: List of backend node endpoints
- healthCheck: Health check configuration
- circuitBreaker: Circuit breaker thresholds
## Outputs
- distribution: Current traffic distribution
- healthStatus: Per-node health status
- metrics: Requests/sec, latency, error rate
- circuitState: Circuit breaker states per node
