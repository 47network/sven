---
name: svc-mesh
description: Configure service mesh routing, mTLS, circuit breakers, and traffic policies
price: 16.99
currency: USD
archetype: engineer
category: container-orchestration
version: 1.0.0
---

## Actions
- create-route: Create service-to-service routing rule
- apply-policy: Apply traffic policy (rate limit, auth, CORS)
- toggle-circuit-breaker: Enable/disable circuit breaker for a route
- traffic-shift: Shift traffic between service versions
- export-config: Export mesh configuration

## Inputs
- sourceService: Source service name
- destService: Destination service name
- weight: Traffic weight percentage
- policyType: Policy type to apply
- meshType: Service mesh implementation

## Outputs
- routeId: Created route ID
- policyId: Applied policy ID
- trafficDistribution: Current traffic distribution
- meshHealth: Overall mesh health status
- latencyP99: P99 latency between services
