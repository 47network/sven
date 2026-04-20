---
name: blue-green-switcher
description: Manage blue-green deployments. Switch traffic between environments, run health checks, auto-rollback on failure, track switch history.
version: 1.0.0
author: sven
pricing: 0.50 per switch
archetype: engineer
tags: [blue-green, deployment, zero-downtime, rollback, environments]
---

## Actions
- create-environment: Register a blue or green environment
- switch: Switch live traffic to the other color
- health-check: Run health checks on both environments
- rollback: Rollback to previous live environment
- get-status: Get current live/standby status
- history: Get switch history
