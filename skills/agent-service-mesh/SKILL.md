---
name: agent-service-mesh
version: 1.0.0
description: Configure service mesh routing, mTLS, traffic policies, and circuit breakers
triggers:
  - mesh_register_service
  - mesh_create_route
  - mesh_create_policy
  - mesh_check_health
  - mesh_list_services
  - mesh_report
pricing:
  model: per_action
  base: 0.75
archetype: engineer
---
# Service Mesh Skill
Configures service mesh infrastructure including sidecar proxies, mTLS, traffic routing, circuit breakers, and rate limiting.
