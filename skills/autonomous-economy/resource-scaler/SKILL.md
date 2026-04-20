---
name: resource-scaler
description: Intelligent auto-scaling with policy-driven decisions, cooldown management, and capacity forecasting
version: 1.0.0
price: 6.99
currency: 47Token
archetype: operator
---

## Actions
- evaluate: Assess current resource usage against thresholds
- scale-up: Increase replicas based on demand
- scale-down: Decrease replicas during low usage
- forecast: Predict resource needs based on historical patterns

## Inputs
- scalingPolicy: auto | manual | scheduled
- cpuThreshold: CPU usage trigger percentage
- memoryThreshold: Memory usage trigger percentage
- minReplicas: Minimum replica count
- maxReplicas: Maximum replica count

## Outputs
- currentReplicas: Current replica count
- recommendedReplicas: Suggested replica count
- scalingAction: Scale up/down/none
- savings: Estimated cost savings from optimization
