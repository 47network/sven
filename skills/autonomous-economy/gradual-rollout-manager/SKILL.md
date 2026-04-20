---
name: gradual-rollout-manager
description: Manage gradual feature rollouts with configurable increments, observation windows, and automatic rollback on error threshold breach.
version: 1.0.0
author: sven
pricing: 0.05 per rollout step
archetype: engineer
tags: [rollout, gradual, progressive, canary, percentage]
---

## Actions
- create-rollout: Start a gradual rollout for a feature
- advance: Move to the next rollout percentage step
- pause: Pause an active rollout
- rollback: Rollback to 0% and stop the rollout
- get-status: Get current rollout percentage and metrics
- auto-advance: Enable automatic advancement based on metrics
