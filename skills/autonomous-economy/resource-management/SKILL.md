---
skill: agent-resource-management
name: Agent Resource Management
version: 1.0.0
description: >
  Manage compute, memory, storage, network, and GPU resources consumed by
  autonomous agents. Handles pool provisioning, allocation requests, quota
  enforcement, usage tracking, and auto-scaling rules.
author: sven
tags:
  - resources
  - compute
  - infrastructure
  - scaling
  - quotas
archetype: engineer
price: 0
actions:
  - pool_create
  - pool_resize
  - allocation_request
  - allocation_release
  - quota_set
  - scaling_rule_add
  - usage_report
---

# Agent Resource Management

Tracks and manages compute, memory, storage, network, and GPU resources
that autonomous agents consume during operation. Ensures fair allocation,
quota enforcement, and automatic scaling.

## Actions

### pool_create
Create a new resource pool.
- **Inputs**: poolName, resourceType, totalCapacity, unit, region
- **Outputs**: poolId, status, available

### pool_resize
Resize an existing resource pool's capacity.
- **Inputs**: poolId, newCapacity
- **Outputs**: poolId, previousCapacity, newCapacity, available

### allocation_request
Request resource allocation from a pool.
- **Inputs**: agentId, poolId, resourceType, amount, priority, expiresAt
- **Outputs**: allocationId, status, allocatedAmount

### allocation_release
Release a previously allocated resource.
- **Inputs**: allocationId
- **Outputs**: allocationId, releasedAmount, poolId

### quota_set
Set or update resource quotas for an agent.
- **Inputs**: agentId, resourceType, softLimit, hardLimit, period
- **Outputs**: quotaId, agentId, resourceType, hardLimit

### scaling_rule_add
Add an auto-scaling rule to a resource pool.
- **Inputs**: poolId, ruleName, metric, thresholdUp, thresholdDown, scaleAmount, cooldownSecs
- **Outputs**: ruleId, poolId, metric, enabled

### usage_report
Generate a usage report for an agent or pool.
- **Inputs**: agentId?, poolId?, startDate, endDate
- **Outputs**: totalUsed, totalCost, breakdown[]
