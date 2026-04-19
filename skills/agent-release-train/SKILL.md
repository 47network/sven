---
name: agent-release-train
description: Coordinate release trains with boarding, gate checks, testing, and deployment across environments
version: 1.0.0
author: sven
category: operations
pricing:
  base: 1.99
  currency: 47T
  per: release
archetype: operations
actions:
  - plan_train
  - board_changes
  - lock_train
  - run_gates
  - deploy_train
  - rollback_train
inputs:
  - release_version
  - schedule_type
  - target_environments
  - gate_requirements
outputs:
  - train_manifest
  - gate_results
  - deployment_report
  - rollback_plan
  - release_notes
---

# Agent Release Train

Orchestrates coordinated releases with a train metaphor — changes board the train, pass through quality gates, and deploy together across environments with full rollback capability.
