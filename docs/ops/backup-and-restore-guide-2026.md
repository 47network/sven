# Backup and Restore Guide

Date: 2026-02-21

## Scope

Operational backup and restore procedure for Sven primary state (database + required config metadata).

## Backup

1. Create a consistent Postgres dump/snapshot.
2. Archive required deployment config (excluding plaintext secrets).
3. Store backup artifact in designated retention location.
4. Record checksum, timestamp, and operator.

## Restore

1. Prepare target environment and stop write-heavy services.
2. Restore database from selected backup artifact.
3. Re-apply required environment/config bindings.
4. Start services and validate:
   - auth/login
   - chat read/write
   - approvals/history access

## Verification

- Run a backup drill periodically: backup -> controlled data change -> restore -> verify baseline recovered.
- Preserve evidence documents for each drill and include pass/fail + remediation notes.

## References

- `docs/release/evidence/migration-backup-drill-2026-02-12.md`
- `docs/release/evidence/migration-backup-drill-2026-02-13.md`
- `docs/release/evidence/nightly-backup-cron-verify-2026-02-21.md`
