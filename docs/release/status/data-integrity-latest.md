# Data Integrity Check

Generated: 2026-02-21T16:00:53.751Z
Status: pass

## Checks
- backup_script_tested: pass
  checklist: Database backup script tested (pg_dump + restore)
  detail: Found drill evidence: docs/release/evidence/migration-backup-drill-2026-02-12.md
  evidence: docs/release/evidence/migration-backup-drill-2026-02-12.md, docs/release/evidence/migration-backup-drill-2026-02-13.md
- wal_archiving: pass
  checklist: WAL archiving configured for point-in-time recovery
  detail: Postgres WAL/PITR markers detected in compose config
  evidence: docker-compose.yml
- nightly_backup_cron: pass
  checklist: Nightly backup cron job active
  detail: Backup cron config, startup sync logic, and runtime verification evidence are present
  evidence: services/gateway-api/src/db/migrations/030_backups_disaster_recovery.sql, services/gateway-api/src/services/BackupService.ts, services/gateway-api/src/index.ts, docs/release/evidence/nightly-backup-cron-verify-2026-02-21.md
- restore_drill: pass
  checklist: Backup restore drill completed and documented
  detail: Found restore drill evidence: docs/release/evidence/migration-backup-drill-2026-02-12.md
  evidence: docs/release/evidence/migration-backup-drill-2026-02-12.md, docs/release/evidence/migration-backup-drill-2026-02-13.md
- nats_jetstream_persistence: pass
  checklist: NATS JetStream persistence verified across restart
  detail: JetStream persistence config and restart verification evidence are present
  evidence: docker-compose.yml, docs/release/evidence/nats-jetstream-persistence-2026-02-21.md
- migration_rollback_last3: pass
  checklist: Migration rollback tested for latest 3 migrations
  detail: Rollback plan and latest-3 execution evidence are present
  evidence: docs/db/migration-rollback-plan.md, docs/release/evidence/migration-rollback-test-050-052-2026-02-21.md

