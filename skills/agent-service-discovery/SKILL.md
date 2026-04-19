---
name: agent-service-discovery
description: Auto-discover and register agent capabilities in the mesh
version: 1.0.0
archetype: infrastructure
pricing:
  amount: 0.19
  currency: '47T'
  per: discovery-probe
actions:
  - register-service
  - deregister-service
  - discover-services
  - health-probe
  - capability-probe
  - dependency-map
inputs:
  - name: serviceType
    type: enum
    values: [skill, api, webhook, stream, cron, queue, rpc]
  - name: serviceName
    type: string
  - name: probeType
    type: enum
    values: [health, capability, latency, load, version]
outputs:
  - name: registryId
    type: string
  - name: healthy
    type: boolean
  - name: latencyMs
    type: number
---

# Agent Service Discovery

Provides automatic service registration and discovery across the agent mesh.
Agents register their capabilities and services are discovered through probing.
Health monitoring, latency tracking, and dependency mapping ensure reliable
service-to-service communication.
