---
name: agent-chaos-testing
description: Controlled fault injection for agent resilience testing
version: 1.0.0
archetype: operations
pricing:
  amount: 2.99
  currency: '47T'
  per: experiment-run
actions:
  - create-experiment
  - inject-fault
  - remove-fault
  - measure-impact
  - abort-experiment
  - experiment-report
inputs:
  - name: blastRadius
    type: enum
    values: [single, crew, district, global]
  - name: faultType
    type: enum
    values: [latency, error, timeout, partition, resource_exhaustion, data_corruption]
  - name: intensity
    type: number
outputs:
  - name: experimentId
    type: string
  - name: passed
    type: boolean
  - name: impactScore
    type: number
---

# Agent Chaos Testing

Enables controlled fault injection to test agent resilience. Run chaos experiments
with configurable blast radius and fault types. Measure impact against baseline
metrics and verify that agents recover gracefully from failures.
