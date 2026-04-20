---
name: agent-circuit-breaker
description: Circuit breaker pattern for agent-to-agent call protection
version: 1.0.0
archetype: infrastructure
pricing:
  amount: 0.39
  currency: '47T'
  per: circuit-evaluation
actions:
  - create-breaker
  - check-state
  - record-success
  - record-failure
  - list-breakers
  - generate-report
inputs:
  - name: targetAgentId
    type: string
  - name: failureThreshold
    type: number
  - name: timeoutMs
    type: number
outputs:
  - name: breakerId
    type: string
  - name: state
    type: enum
    values: [closed, open, half_open]
  - name: allowed
    type: boolean
---

# Agent Circuit Breaker

Implements the circuit breaker pattern to protect agent-to-agent calls from cascading
failures. Monitors failure rates and automatically opens the circuit when thresholds
are exceeded, preventing further calls until the target recovers.
