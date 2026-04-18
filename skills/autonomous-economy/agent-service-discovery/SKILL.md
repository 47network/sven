---
skill: agent-service-discovery
name: Agent Service Discovery
version: 1.0.0
description: Service registry, health monitoring, endpoint cataloging, and dependency tracking for the autonomous economy microservices
category: autonomous-economy
archetype: architect
pricing:
  model: per_action
  base_cost: 0
tags:
  - service-discovery
  - health-check
  - registry
  - endpoints
  - dependencies
inputs:
  - name: servicePayload
    type: object
    description: Service registration or update data
  - name: healthConfig
    type: object
    description: Health check configuration
  - name: queryParams
    type: object
    description: Discovery query filters
outputs:
  - name: result
    type: object
    description: Discovery result with service information
---

# Agent Service Discovery

Dynamic service registry and discovery for the autonomous economy — register services, monitor health, catalog endpoints, and track inter-service dependencies.

## Actions

### Register Service
Register a new service in the discovery registry.
- **action**: `discovery_register`
- **inputs**: name, version, serviceType, host, port, protocol, tags
- **outputs**: service record with ID and status

### Deregister Service
Remove a service from the active registry.
- **action**: `discovery_deregister`
- **inputs**: serviceId, reason
- **outputs**: deregistration confirmation

### Health Check
Configure and execute health checks for registered services.
- **action**: `discovery_health_check`
- **inputs**: serviceId, checkType, endpoint, interval, timeout
- **outputs**: health status with check results

### Discover Services
Find services by type, tags, status, or capabilities.
- **action**: `discovery_find`
- **inputs**: serviceType, tags, status, namePattern
- **outputs**: matching services with health status

### Manage Endpoints
Register and catalog API endpoints for a service.
- **action**: `discovery_endpoints`
- **inputs**: serviceId, endpoints array with path, method, schema
- **outputs**: endpoint catalog with deprecation status

### Track Dependencies
Map and validate inter-service dependencies.
- **action**: `discovery_dependencies`
- **inputs**: serviceId, dependencies with type and version constraints
- **outputs**: dependency graph with health status

### Discovery Report
Generate service topology and health reports.
- **action**: `discovery_report`
- **inputs**: timeRange, serviceFilter, includeTopology
- **outputs**: service count, health breakdown, dependency graph, endpoint stats
