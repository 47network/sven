---
name: feature-flag-engine
version: 1.0.0
description: Feature toggles with percentage rollouts, user targeting, and A/B testing
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: analyst
tags: [feature-flag, toggle, rollout, ab-test, targeting, variant]
---

# Feature Flag Engine

Manages feature flags for agents with percentage-based rollouts, user targeting
rules, variant assignment, and evaluation tracking for A/B testing.

## Actions

- **create-flag**: Create a new feature flag
- **evaluate-flag**: Evaluate a flag for a subject
- **update-flag**: Update flag configuration
- **toggle-flag**: Enable or disable a flag
- **set-rollout**: Set percentage rollout value
- **get-evaluations**: Get flag evaluation history

## Inputs

- `flagKey` — Unique flag identifier
- `flagType` — boolean, percentage, variant, or user_list
- `rolloutPercentage` — Rollout percentage (0-100)
- `targetingRules` — Array of targeting rule objects
- `subjectId` — Subject to evaluate flag for
- `variants` — Variant definitions for A/B tests

## Outputs

- `flagId` — Created flag identifier
- `enabled` — Current flag state
- `result` — Evaluation result
- `reason` — Why this result was returned
- `variant` — Assigned variant (if applicable)
