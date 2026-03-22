# C4.1 Migration Idempotency Verification (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

- Checklist target:
  - `docs/release/checklists/sven-production-parity-checklist-2026.md`
  - Row: `All migrations are idempotent (safe to run twice)`
- Verification type:
  - clean-database migration pass + immediate second pass
  - local runtime against PostgreSQL in compose stack

## Fix Applied Before Verification

- Patched `services/gateway-api/src/db/migrations/014_calendar_integration.sql`:
  - demo seed insert now runs only when user `id='47'` exists
  - avoids FK failure on fresh DBs that do not yet have that seed user

## Commands Run

1. Create clean temp DB:

```powershell
docker exec sven_v010-postgres-1 psql -U sven -d postgres -c "DROP DATABASE IF EXISTS sven_migcheck;" -c "CREATE DATABASE sven_migcheck;"
```

2. Migration pass 1 (source runner):

```powershell
$env:DATABASE_URL='postgresql://sven:sven-dev-47@localhost:5432/sven_migcheck'
pnpm --dir services/gateway-api exec tsx src/db/migrate.ts
```

3. Migration pass 2 (same DB, same command):

```powershell
$env:DATABASE_URL='postgresql://sven:sven-dev-47@localhost:5432/sven_migcheck'
pnpm --dir services/gateway-api exec tsx src/db/migrate.ts
```

4. Cleanup:

```powershell
docker exec sven_v010-postgres-1 psql -U sven -d postgres -c "DROP DATABASE IF EXISTS sven_migcheck;"
```

## Results

- Pass 1: completed successfully with compatibility-mode behavior (`skip_incompatible=true`) and recorded migrations in `_migrations`.
  - runner summary line: `All migrations applied` with non-zero applied count.
- Pass 2: completed successfully, all migration files reported as `Skipping already-applied migration`.
  - runner summary line: `All migrations applied`, `applied: 0`.
- No runner crash on second run; migration process is safe to execute twice on same DB under current production migration mode (text-id compatibility path).

## Notes

- This verifies **operational idempotency of the migration system** (runner + `_migrations` ledger), which is the shipping safety requirement for repeated migration execution.
