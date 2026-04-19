---
name: agent-feature-flags
version: 1.0.0
description: Feature flag management with gradual rollouts, A/B variants, and targeting rules
author: sven-platform
pricing:
  base: 0.10
  currency: "47T"
  per: "flag evaluation batch"
tags: [feature-flags, rollouts, ab-testing, toggles, targeting]
inputs:
  - flagKey: string
  - flagType: boolean | percentage | variant | schedule
  - rolloutPct: number (0-100)
  - variants: array
  - targetingRules: object
outputs:
  - flagId: string
  - evaluationResult: object
  - auditTrail: array
actions:
  - create-flag
  - evaluate-flag
  - toggle-flag
  - update-rollout
  - list-flags
  - audit-history
archetype: engineer
---

# Agent Feature Flags

Manages feature flags for gradual rollouts, A/B testing, and conditional feature activation across agent services.

## Capabilities
- Boolean, percentage-based, variant, and scheduled flag types
- Targeting rules for context-aware evaluation
- Rollout percentage control for gradual feature releases
- Full audit trail of all flag changes
- Batch evaluation for high-throughput services
