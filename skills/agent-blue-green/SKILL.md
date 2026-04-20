---
name: agent-blue-green
version: 1.0.0
description: Blue-green deployment orchestration with traffic splitting and health-aware switching
category: platform-ops
pricing: { model: per_request, base: 0.05 }
archetype: operator
triggers:
  - blue_green
  - traffic_split
  - deployment_switch
  - stage_switch
actions:
  - create_deployment
  - deploy_version
  - switch_stage
  - set_traffic_split
  - list_deployments
  - report
inputs:
  - name: action
    type: string
    required: true
  - name: deploymentData
    type: object
    description: Service name, environment, version info
  - name: switchConfig
    type: object
    description: Switch criteria and reason
  - name: trafficConfig
    type: object
    description: Traffic split percentages and strategy
outputs:
  - name: deployment
    type: object
  - name: switchResult
    type: object
  - name: trafficSplit
    type: object
  - name: stats
    type: object
---

# Agent Blue-Green Deployment

Orchestrates blue-green deployments with gradual traffic shifting, health monitoring, and instant rollback.
