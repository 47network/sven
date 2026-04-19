---
name: agent-service-registry
version: 1.0.0
description: Service discovery and registration for agent microservices
author: sven-autonomous
pricing:
  base: 0.00
  currency: "47T"
archetype: engineer
---

# Agent Service Registry

Manages service registration, health checking, and discovery for the agent microservice fleet.

## Actions
- register-service: Register a new service instance with health check configuration
- deregister-service: Remove a service instance from the registry
- discover-services: Find healthy instances of a named service
- check-health: Run health checks against registered instances
- list-endpoints: List all endpoints for a service
- update-metadata: Update service instance metadata and tags

## Inputs
- serviceName: Name of the service to register/discover
- host: Service host address
- port: Service port number
- protocol: Communication protocol (http, grpc, tcp, ws)
- healthCheck: Health check configuration (type, endpoint, interval)
- tags: Service tags for filtering

## Outputs
- instances: List of discovered service instances
- healthStatus: Current health status per instance
- endpoints: Available service endpoints
- registrationId: ID of newly registered service
