---
name: agent-canary-deploy
description: Gradual rollout of agent behavior changes with metrics comparison
version: 1.0.0
archetype: operations
pricing:
  amount: 1.49
  currency: '47T'
  per: canary-evaluation
actions:
  - create-deploy
  - start-canary
  - adjust-traffic
  - evaluate-metrics
  - promote-canary
  - rollback-canary
inputs:
  - name: target
    type: enum
    values: [skill, prompt, config, workflow, handler]
  - name: trafficPct
    type: number
  - name: successThreshold
    type: number
outputs:
  - name: deployId
    type: string
  - name: status
    type: string
  - name: decision
    type: enum
    values: [promote, rollback, continue, pause]
---

# Agent Canary Deploy

Enables gradual rollout of agent behavior changes by splitting traffic between baseline
and canary versions. Automatically collects metrics, compares performance, and makes
promote/rollback decisions based on configurable success thresholds.
