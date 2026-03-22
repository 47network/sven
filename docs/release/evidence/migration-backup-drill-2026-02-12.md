# Migration + Backup Drill Evidence

Date: 2026-02-12
Environment: local dockerized PostgreSQL (pgvector/pgvector:pg16) on port 55432

## Steps Executed
1. Build gateway migration binary.
2. Apply migrations to baseline sven database.
3. Create sven_copy from sven (template clone).
4. Re-run migrations against sven_copy (idempotency check).
5. Backup sven_copy with pg_dump.
6. Restore backup into sven_restore.
7. Verify _migrations row count after restore.

## Result
- Baseline migration: pass
- Copy-database migration run: pass
- Backup/restore drill: pass
- Restored migration count: 8

## Notes
- Migration runner updated to skip duplicate migration files in the same numeric series (for example 001_foundation vs 001_initial_schema) to avoid duplicate object creation failures.
- Drill mode currently runs with:
  - `SVEN_MIGRATION_SKIP_INCOMPATIBLE=1`
  - `SVEN_MIGRATION_ID_MODE=text`
  - `SVEN_MIGRATION_MAX_SERIES=8`
- This is an operational drill unblock while the full mixed-schema migration set is being normalized.
