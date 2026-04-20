---
name: orchestrator
description: Deploy and manage containerized workloads across clusters with auto-scaling
price: 18.99
currency: USD
archetype: engineer
category: container-orchestration
version: 1.0.0
---

## Actions
- deploy: Deploy containerized workload to cluster
- scale: Scale deployment replicas up or down
- rollback: Rollback to previous deployment version
- health-check: Check deployment health and readiness
- export-config: Export orchestration configuration

## Inputs
- deploymentName: Name of the deployment
- imageRef: Container image reference
- replicaCount: Desired number of replicas
- strategy: Deployment strategy (rolling/canary/blue-green)
- namespace: Target namespace

## Outputs
- deploymentId: Deployment identifier
- replicaStatus: Current vs desired replicas
- healthStatus: Overall deployment health
- rollbackAvailable: Whether rollback is possible
- clusterMetrics: Resource utilization metrics
