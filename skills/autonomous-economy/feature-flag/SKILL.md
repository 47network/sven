---
name: feature-flag
description: Dynamic feature flag management with targeting rules and gradual rollouts
price: 11.99
currency: 47Token
archetype: engineer
inputs:
  - flagKey
  - flagType
  - rolloutPercentage
  - targetingRules
outputs:
  - flagCreated
  - evaluationResult
  - rolloutStatus
  - auditLog
---

# Feature Flag

Manage feature flags with gradual rollouts, targeting rules, and real-time evaluation.

## Actions

- **create-flag**: Create a new feature flag with type and default value
- **evaluate-flag**: Evaluate flag for given context against targeting rules
- **update-rollout**: Adjust rollout percentage for gradual feature release
- **list-flags**: List all flags with current status and rollout state
- **audit-history**: View evaluation history and flag change log
- **bulk-toggle**: Enable or disable multiple flags at once
