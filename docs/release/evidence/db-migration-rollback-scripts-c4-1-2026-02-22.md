# C4.1 Migration Rollback Scripts Coverage (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

- Checklist target:
  - `docs/release/checklists/sven-production-parity-checklist-2026.md`
  - Row: `All migrations have rollback scripts`

## Implemented

- Added rollback SQL directory:
  - `services/gateway-api/src/db/rollbacks`
- Ensured one rollback SQL file exists for each migration SQL in:
  - `services/gateway-api/src/db/migrations`
  - Coverage result: `118/118`
- Added rollback runner:
  - `services/gateway-api/src/db/rollback.ts`
  - Supports:
    - `--steps <n>` (default `1`)
    - `--name <migration.sql>`
- Added rollback coverage checker:
  - `services/gateway-api/src/db/rollback-check.ts`
- Added npm scripts:
  - `services/gateway-api/package.json`
    - `db:migrate:down`
    - `db:rollback:check`
- Docker image now includes rollback SQL files:
  - `services/gateway-api/Dockerfile`

## Validation

1. Build:
```powershell
pnpm --dir services/gateway-api run build
```
Result: pass.

2. Coverage check:
```powershell
pnpm --dir services/gateway-api run db:rollback:check
```
Result: `Rollback coverage OK: 118/118 migrations have rollback SQL.`

3. Rollback runner sanity test (temp DB):
```powershell
docker exec sven_v010-postgres-1 psql -U sven -d postgres -c "DROP DATABASE IF EXISTS sven_rbcheck;" -c "CREATE DATABASE sven_rbcheck;"
$env:DATABASE_URL='postgresql://sven:sven-dev-47@localhost:5432/sven_rbcheck'
pnpm --dir services/gateway-api exec tsx src/db/migrate.ts
pnpm --dir services/gateway-api exec tsx src/db/rollback.ts --steps 1
docker exec sven_v010-postgres-1 psql -U sven -d postgres -c "DROP DATABASE IF EXISTS sven_rbcheck;"
```
Result: pass (`116_sessions_refresh_status.sql` rollback script applied successfully).

## Notes

- Current rollback SQL files are forward-safe placeholders (`BEGIN/COMMIT` no-op) by default.
- Hard/destructive rollback remains governed by:
  - `docs/db/migration-rollback-plan.md`
  - backup/restore workflow.
