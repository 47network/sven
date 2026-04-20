---
name: agent-backup-scheduling
triggers:
  - backup_create_schedule
  - backup_trigger_snapshot
  - backup_restore
  - backup_verify_integrity
  - backup_cleanup_expired
  - backup_report
intents:
  - Create and manage automated backup schedules
  - Trigger manual backup snapshots
  - Restore data from backup snapshots
outputs:
  - Backup schedule confirmations
  - Snapshot completion reports
  - Restore job status and progress
---

# Agent Backup Scheduling

Manages automated backup schedules, snapshot creation, integrity verification, and restore operations across storage backends.
