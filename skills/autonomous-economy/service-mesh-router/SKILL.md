---
name: service-mesh-router
version: 1.0.0
description: Service mesh traffic routing and management for microservices
category: observability
pricing: { model: per_use, base_cost: 3.99 }
archetype: analyst
---

# Service Mesh Router

Manages service mesh traffic routing, load balancing, circuit breaking, and health checks across microservice architectures.

## Actions

- **register-service**: Register a new service in the mesh
- **configure-routing**: Set routing strategy and weights
- **create-traffic-rule**: Create traffic routing rules with match criteria
- **health-check**: Run health checks across all mesh services
- **toggle-circuit-breaker**: Enable/disable circuit breaker for a service
- **export-topology**: Export mesh topology diagram

## Inputs

- meshName: string — Service mesh identifier
- serviceName: string — Target service name
- routingStrategy: RoutingStrategy — round_robin, least_connections, weighted, etc.
- matchCriteria: object — Traffic matching rules (headers, paths, etc.)

## Outputs

- meshId: string — Mesh configuration ID
- services: MeshService[] — Registered services with health status
- topology: object — Mesh topology visualization data
