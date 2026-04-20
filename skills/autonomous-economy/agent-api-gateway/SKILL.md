---
skill: agent-api-gateway
name: Agent API Gateway & Routing
description: API route management, gateway policies, request transformation, load balancing, and traffic analytics for agent services
version: 1.0.0
category: infrastructure
pricing:
  model: per_action
  base_cost: 0.50
---

# Agent API Gateway & Routing

Manage API routes, attach gateway policies, configure load balancers, transform requests, and analyze traffic.

## Actions

### route_create
Create an API route with path, method, target URL, auth requirements, and rate limits.

### policy_attach
Attach a gateway policy (CORS, auth, throttle, circuit breaker) to routes.

### transform_add
Add request/response transformations (header manipulation, body rewrite, URL rewrite).

### pool_configure
Configure a load balancer pool with algorithm, targets, and health checks.

### traffic_analyze
Analyze traffic logs for latency, error rates, and request volume patterns.

### route_test
Test an API route with a synthetic request and validate the response.

### gateway_report
Generate a gateway health report with route status, policy coverage, and traffic stats.
