---
name: agent-feature-flags
description: Dynamic feature toggling for agent capabilities
version: 1.0.0
archetype: operations
pricing:
  amount: 0.09
  currency: '47T'
  per: flag-evaluation
actions:
  - create-flag
  - evaluate-flag
  - toggle-flag
  - add-rule
  - list-flags
  - generate-report
inputs:
  - name: flagKey
    type: string
  - name: flagKind
    type: enum
    values: [boolean, percentage, variant, schedule]
  - name: conditionType
    type: enum
    values: [agent_id, archetype, tag, percentage, schedule, always]
outputs:
  - name: flagId
    type: string
  - name: evaluatedValue
    type: any
  - name: matchedRule
    type: string
---

# Agent Feature Flags

Provides dynamic feature toggling for agent capabilities. Supports boolean, percentage,
variant, and schedule-based flags with rule-based targeting by agent ID, archetype,
tags, or custom conditions. Enables safe experimentation and gradual feature rollout.
