---
name: feature-flag-manager
description: Manage feature flags with multiple strategies (boolean, percentage, user-list, gradual, schedule). Target specific users, audit evaluations, detect stale flags.
version: 1.0.0
author: sven
pricing: 0.01 per 1000 evaluations
archetype: engineer
tags: [feature-flags, toggles, rollout, targeting, experimentation]
---

## Actions
- create-flag: Create a new feature flag with strategy
- evaluate: Evaluate a flag for a given context
- toggle: Enable or disable a flag
- set-rollout: Set percentage rollout for a flag
- list-stale: Find flags not modified within stale threshold
- audit: Get evaluation history for a flag
