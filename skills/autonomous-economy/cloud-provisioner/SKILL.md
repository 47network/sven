---
name: cloud-provisioner
description: Provision and manage cloud infrastructure resources across providers
version: 1.0.0
price: 19.99
currency: USD
archetype: engineer
tags: [cloud, infrastructure, provisioning, devops]
---

# Cloud Provisioner

Automated cloud resource provisioning, scaling, and lifecycle management.

## Actions

### provision-resource
Provision a new cloud resource (VM, container, storage, network).
- **inputs**: provider, resourceType, specs, region, name
- **outputs**: resourceId, state, provisionedAt, specs

### destroy-resource
Destroy a provisioned resource and clean up.
- **inputs**: resourceId, force
- **outputs**: destroyed, finalCost, destroyedAt

### scale-resources
Auto-scale resources based on demand metrics.
- **inputs**: configId, targetMetric, threshold, minCount, maxCount
- **outputs**: currentCount, scaledTo, costImpact

### estimate-cost
Estimate cost for a resource configuration.
- **inputs**: provider, resourceType, specs, durationHours
- **outputs**: estimatedCostCents, breakdown, alternatives

### audit-resources
Audit all resources for cost optimization.
- **inputs**: configId, includeUnused, costThreshold
- **outputs**: resources[], unusedCount, savingsOpportunity

### export-inventory
Export full resource inventory report.
- **inputs**: configId, format, includeDestroyed
- **outputs**: inventory[], totalCost, resourceCount
