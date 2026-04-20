---
skill: agent-backup-recovery
name: Agent Backup & Recovery
version: 1.0.0
description: >
  Automated backup scheduling, snapshot management, recovery point creation,
  retention policy enforcement, and disaster recovery planning for autonomous agents.
  Ensures agent state, configuration, and data are preserved and recoverable.
author: sven
tags:
  - backup
  - recovery
  - disaster-recovery
  - snapshot
  - retention
  - resilience
actions:
  - id: backup_create
    name: Create Backup
    description: >
      Create a new backup job for an agent — full, incremental, differential,
      snapshot, or selective. Captures agent state, configuration, skill data,
      and runtime artifacts.
    inputs:
      - name: agentId
        type: string
        required: true
      - name: backupType
        type: BackupType
        required: true
      - name: sourcePath
        type: string
        required: false
      - name: destination
        type: string
        required: false
    outputs:
      - name: jobId
        type: string
      - name: status
        type: BackupStatus
      - name: sizeBytes
        type: number
    pricing:
      amount: 0.99
      currency: USD
      per: backup

  - id: backup_restore
    name: Restore from Backup
    description: >
      Restore an agent from a recovery point. Supports full restore, partial
      restore, point-in-time recovery, and granular item-level recovery.
    inputs:
      - name: recoveryPointId
        type: string
        required: true
      - name: restoreTarget
        type: string
        required: false
      - name: restoreType
        type: RestoreType
        required: true
    outputs:
      - name: restoreLogId
        type: string
      - name: itemsRestored
        type: number
      - name: durationMs
        type: number
    pricing:
      amount: 1.99
      currency: USD
      per: restore

  - id: recovery_point_create
    name: Create Recovery Point
    description: >
      Create a named recovery point (snapshot) for an agent that can be
      used for future restores. Optionally linked to a backup job.
    inputs:
      - name: agentId
        type: string
        required: true
      - name: recoveryType
        type: RecoveryType
        required: true
      - name: backupJobId
        type: string
        required: false
      - name: expiresAt
        type: string
        required: false
    outputs:
      - name: recoveryPointId
        type: string
      - name: status
        type: RecoveryPointStatus
    pricing:
      amount: 0.49
      currency: USD
      per: point

  - id: retention_set
    name: Set Retention Policy
    description: >
      Define or update a retention policy for an agent's backups — how long
      to keep backups, maximum count, and automatic cleanup scheduling.
    inputs:
      - name: agentId
        type: string
        required: true
      - name: policyName
        type: string
        required: true
      - name: retentionDays
        type: number
        required: true
      - name: maxBackups
        type: number
        required: false
      - name: scheduleCron
        type: string
        required: false
    outputs:
      - name: policyId
        type: string
      - name: isActive
        type: boolean
    pricing:
      amount: 0.00
      currency: USD
      per: policy

  - id: dr_plan_create
    name: Create DR Plan
    description: >
      Create a disaster recovery plan with RTO/RPO targets, failover targets,
      and ordered recovery steps for an agent.
    inputs:
      - name: agentId
        type: string
        required: true
      - name: planName
        type: string
        required: true
      - name: priority
        type: DrPriority
        required: true
      - name: rtoMinutes
        type: number
        required: true
      - name: rpoMinutes
        type: number
        required: true
      - name: steps
        type: array
        required: true
    outputs:
      - name: planId
        type: string
      - name: isActive
        type: boolean
    pricing:
      amount: 2.99
      currency: USD
      per: plan

  - id: dr_test
    name: Test DR Plan
    description: >
      Execute a dry-run test of a disaster recovery plan to validate that
      recovery procedures work correctly within RTO/RPO targets.
    inputs:
      - name: drPlanId
        type: string
        required: true
    outputs:
      - name: testResult
        type: string
      - name: actualRtoMinutes
        type: number
      - name: passed
        type: boolean
    pricing:
      amount: 1.49
      currency: USD
      per: test

  - id: restore_log_query
    name: Query Restore Logs
    description: >
      Query historical restore operations for an agent — filter by type,
      status, date range. Useful for audit and compliance.
    inputs:
      - name: agentId
        type: string
        required: true
      - name: restoreType
        type: RestoreType
        required: false
      - name: status
        type: string
        required: false
    outputs:
      - name: logs
        type: array
      - name: totalCount
        type: number
    pricing:
      amount: 0.00
      currency: USD
      per: query
---

# Agent Backup & Recovery

Automated backup scheduling, snapshot management, recovery points, retention policies,
and disaster recovery planning for Sven's autonomous agents. Ensures every agent's
state, configuration, learned skills, and runtime data can be preserved and recovered
from any failure scenario.

## Features

- **Multi-type backups**: Full, incremental, differential, snapshot, and selective
- **Recovery points**: Named snapshots with expiration for point-in-time recovery
- **Retention policies**: Automated cleanup based on age and count limits
- **Disaster recovery plans**: RTO/RPO targets with ordered recovery steps
- **DR testing**: Dry-run validation of recovery procedures
- **Restore logging**: Full audit trail of all recovery operations
