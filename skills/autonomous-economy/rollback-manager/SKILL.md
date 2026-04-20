---
name: rollback-manager
description: Deployment snapshot management with automated rollback capabilities
price: 15.99
currency: 47Token
archetype: engineer
inputs:
  - deploymentId
  - version
  - snapshotData
  - rollbackReason
outputs:
  - snapshotCreated
  - rollbackExecuted
  - versionRestored
  - operationLog
---

# Rollback Manager

Create deployment snapshots and perform automated rollbacks on failure detection.

## Actions

- **create-snapshot**: Capture current deployment state as a restorable snapshot
- **list-snapshots**: View all available snapshots with versions and timestamps
- **execute-rollback**: Roll back to a specific snapshot version
- **auto-rollback**: Configure automatic rollback triggers on failure
- **compare-versions**: Diff two deployment versions for changes
- **cleanup-expired**: Remove snapshots past retention period
