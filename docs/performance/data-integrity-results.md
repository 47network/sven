# Data Integrity Results

## Scope (C1.3)

- Database backup script tested (`pg_dump` + restore)
- WAL archiving configured for point-in-time recovery
- Nightly backup cron job active
- Backup restore drill completed and documented
- NATS JetStream persistence verified across restart
- Migration rollback tested for latest 3 migrations

## Runner

- Script: `scripts/data-integrity-check.cjs`
- Outputs:
- `docs/release/status/data-integrity-latest.json`
- `docs/release/status/data-integrity-latest.md`

## Run Command

```bash
node scripts/data-integrity-check.cjs
```

## Current Evidence Links

- Backup/restore drill evidence:
- `docs/release/evidence/migration-backup-drill-2026-02-12.md`
- `docs/release/evidence/migration-backup-drill-2026-02-13.md`
- Rollback plan:
- `docs/db/migration-rollback-plan.md`
- Nightly backup cron verification:
- `docs/release/evidence/nightly-backup-cron-verify-2026-02-21.md`
- JetStream persistence verification:
- `docs/release/evidence/nats-jetstream-persistence-2026-02-21.md`
- Latest-3 migration rollback verification:
- `docs/release/evidence/migration-rollback-test-050-052-2026-02-21.md`

## Interpretation Rules

- `pass`: item has direct evidence.
- `warn`: item is configured/documented but operational verification evidence is still required.
- `fail`: missing configuration or evidence.

## Notes

- `warn` must not be marked complete in release checklist until execution evidence is captured.
- WAL/PITR and JetStream restart rows require runtime drill proof, not just static config presence.
