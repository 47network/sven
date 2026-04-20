---
name: blue-green-router
description: Blue-green deployment routing with health-aware traffic switching
price: 19.99
currency: 47Token
archetype: engineer
inputs:
  - slotColor
  - endpointUrl
  - switchStrategy
  - healthCheckConfig
outputs:
  - slotDeployed
  - trafficSwitched
  - healthReport
  - switchHistory
---

# Blue-Green Router

Manage blue-green deployment slots with health-aware traffic switching and warmup.

## Actions

- **deploy-slot**: Deploy a new version to the inactive slot
- **switch-traffic**: Switch live traffic from current to target slot
- **health-check**: Run health checks on both slots
- **warmup-slot**: Warm up inactive slot before traffic switch
- **rollback-switch**: Revert traffic to previous slot
- **slot-status**: View current state of both environment slots
