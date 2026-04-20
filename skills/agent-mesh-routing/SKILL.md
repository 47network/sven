---
name: agent-mesh-routing
description: Intelligent message and task routing across agent mesh networks
version: 1.0.0
archetype: infrastructure
pricing:
  amount: 0.49
  currency: '47T'
  per: route-evaluation
actions:
  - create-table
  - add-route
  - evaluate-route
  - update-health
  - list-routes
  - generate-report
inputs:
  - name: policy
    type: enum
    values: [round_robin, weighted, latency, priority, failover, broadcast]
  - name: pattern
    type: string
  - name: weight
    type: number
outputs:
  - name: routeDecision
    type: object
  - name: selectedDestination
    type: string
  - name: latencyMs
    type: number
---

# Agent Mesh Routing

Routes messages and tasks intelligently across the agent mesh network using configurable
policies. Supports round-robin, weighted, latency-based, priority, failover, and
broadcast routing strategies with health-aware load balancing.
