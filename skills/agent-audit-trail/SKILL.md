---
name: agent-audit-trail
version: 1.0.0
description: Immutable audit logging with snapshots and configurable retention policies
category: platform-ops
pricing: { model: per_request, base: 0.01 }
archetype: analyst
triggers:
  - audit_trail
  - audit_log
  - audit_snapshot
  - retention_policy
actions:
  - log_entry
  - create_snapshot
  - set_retention
  - search_entries
  - list_entries
  - report
inputs:
  - name: action
    type: string
    required: true
  - name: entryData
    type: object
    description: Audit entry with action, scope, resource details
  - name: snapshotConfig
    type: object
    description: Snapshot type and scope
  - name: retentionConfig
    type: object
    description: Retention policy parameters
outputs:
  - name: entry
    type: object
  - name: snapshot
    type: object
  - name: searchResults
    type: array
  - name: stats
    type: object
---

# Agent Audit Trail

Provides immutable audit logging with full before/after state tracking, snapshots, and retention management.
