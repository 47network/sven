---
skill: agent-versioning-rollback
name: Agent Versioning & Rollback
version: 1.0.0
description: Version control for agent configurations with snapshot, rollback, deployment slots, and diff tracking
category: infrastructure
tags: [versioning, rollback, deployment, snapshots, canary, slots]
autonomous: true
economy:
  pricing: per-operation
  base_cost: 0.25
---

# Agent Versioning & Rollback

Comprehensive version control system for agent configurations, skills, and state.
Supports semantic versioning, full/partial snapshots, multi-slot deployments,
automatic rollbacks on health degradation, and version diffing.

## Actions

### version_create
Create a new version snapshot for an agent with semantic versioning.
- **Inputs**: agentId, changelog?, bumpType (major|minor|patch)?
- **Outputs**: versionId, versionTag, snapshotId, configHash

### snapshot_take
Take a point-in-time snapshot of agent state (full or partial).
- **Inputs**: versionId, snapshotType, compress?
- **Outputs**: snapshotId, sizeBytes, compressed, expiresAt

### rollback_initiate
Initiate a rollback from current version to a previous stable version.
- **Inputs**: agentId, toVersionId, reason?, rollbackType?
- **Outputs**: rollbackId, status, fromVersion, toVersion

### slot_assign
Assign a version to a deployment slot with traffic percentage.
- **Inputs**: agentId, slotName, versionId, trafficPct?
- **Outputs**: slotId, slotName, versionTag, trafficPct

### diff_generate
Generate a diff between two versions showing changes.
- **Inputs**: agentId, fromVersionId, toVersionId, diffType?
- **Outputs**: diffId, additions, removals, modifications, summary

### version_promote
Promote a version from staging/canary to production.
- **Inputs**: agentId, versionId, fromSlot?, toSlot?
- **Outputs**: promoted, previousVersion, newVersion, slotUpdated

### rollback_cancel
Cancel a pending or in-progress rollback.
- **Inputs**: rollbackId, reason?
- **Outputs**: rollbackId, cancelled, previousStatus
