---
name: volume-manager
description: Persistent volume lifecycle management with snapshots, encryption, and automated backups
version: 1.0.0
price: 7.99
currency: 47Token
archetype: operator
---
## Actions
- provision: Create and attach persistent volume
- snapshot: Create point-in-time volume snapshot
- resize: Expand volume capacity online
- backup: Backup volume data to external storage
## Inputs
- storageClass: Storage tier (standard, ssd, nvme)
- sizeGb: Requested volume size
- encryption: Encryption settings
- backupSchedule: Automated backup schedule
## Outputs
- volumeId: Created volume identifier
- mountPath: Volume mount path
- snapshotId: Snapshot identifier if created
- usageMetrics: Current usage statistics
