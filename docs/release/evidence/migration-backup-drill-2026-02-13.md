# Migration + Backup Drill Evidence

Date: 2026-02-13
Environment: local dockerized PostgreSQL (pgvector/pgvector:pg16) on port 15432

## Steps Executed
1. Apply gateway migrations to baseline `sven` database with drill flags.
2. Clone baseline into `sven_copy` (`CREATE DATABASE ... TEMPLATE sven`).
3. Re-run migrations against `sven_copy` (idempotency check).
4. Backup `sven_copy` via `pg_dump`.
5. Restore dump into `sven_restore`.
6. Verify migration history exists and count rows.

## Result
- Baseline migration: pass
- Copy-database migration run: pass
- Backup/restore drill: pass
- Restored migration row count (`_migrations`): 8

## Notes
- Current schema baseline uses `_migrations` (not `migrations`).
- CI workflow check was updated to accept either `_migrations` or `migrations` and fail only if neither exists.
- Drill mode flags used:
  - `SVEN_MIGRATION_SKIP_INCOMPATIBLE=1`
  - `SVEN_MIGRATION_ID_MODE=text`
  - `SVEN_MIGRATION_MAX_SERIES=8`
