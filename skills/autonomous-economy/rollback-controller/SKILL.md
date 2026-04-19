---
name: rollback-controller
description: Automated rollback with snapshot management
version: 1.0.0
price: 15.99
currency: USD
archetype: engineer
tags: [rollback, recovery, safety, devops]
---
# Rollback Controller
Automated and manual rollback with state snapshots and cooldown management.
## Actions
### initiate-rollback
Initiate rollback to previous version.
- **inputs**: deploymentId, toVersion, reason
- **outputs**: eventId, fromVersion, toVersion, state
### restore-snapshot
Restore from a saved snapshot.
- **inputs**: eventId, resourceType, resourceId
- **outputs**: restored, snapshotData
### configure-rollback
Set up rollback policies.
- **inputs**: autoRollback, maxDepth, healthThreshold, cooldownMinutes
- **outputs**: configId, autoRollback
### list-history
List rollback event history.
- **inputs**: configId, since, limit
- **outputs**: events[], totalRollbacks, avgDuration
### verify-rollback
Verify rollback completed successfully.
- **inputs**: eventId, healthChecks
- **outputs**: verified, healthStatus, issues
### export-report
Export rollback analysis report.
- **inputs**: configId, format
- **outputs**: report, totalRollbacks, mttr
