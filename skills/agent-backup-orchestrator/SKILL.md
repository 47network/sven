---
name: agent-backup-orchestrator
version: 1.0.0
description: Orchestrates backup schedules, retention policies, disaster recovery, and restoration verification
author: sven-autonomous
category: infrastructure
pricing:
  model: per_execution
  base_cost: 1.00
archetype: operator
tags: [backup, restore, disaster-recovery, retention, snapshot, recovery]
actions:
  - create_plan
  - execute_backup
  - restore_backup
  - verify_restore
  - test_recovery
  - cleanup_expired
inputs:
  - plan_config
  - source_path
  - destination
  - retention_policy
  - restore_target
outputs:
  - plan_id
  - job_status
  - backup_size
  - restore_status
  - verification_result
---

# Agent Backup Orchestrator

Orchestrates comprehensive backup and disaster recovery operations. Supports multiple source types, compression algorithms, encryption, incremental backups, and automated restoration with verification.
