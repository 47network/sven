---
name: service-mesh-manager
description: Manages service discovery, traffic routing, circuit breaking, and load balancing across microservices
version: 1.0.0
pricing: 29.99
currency: USD
billing: per_mesh
archetype: engineer
tags: [service-mesh, microservices, routing, circuit-breaker, load-balancing, discovery]
---
# Service Mesh Manager
Orchestrates microservice communication with automatic discovery, intelligent traffic routing, circuit breakers, and load balancing.
## Actions
### register-service
Registers a service with endpoints, version, and health check configuration.
### create-route
Creates a routing rule between services with match conditions and retry policies.
### check-mesh-health
Returns health status of all services in the mesh with instance counts.
### configure-circuit-breaker
Sets circuit breaker thresholds and recovery parameters for a service route.
### update-traffic-weight
Adjusts traffic distribution weights for canary or blue-green deployments.
### list-services
Lists all registered services with their endpoints, versions, and health status.
