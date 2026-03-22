# C4.2 Read Replica Support (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

- Checklist target:
  - `docs/release/checklists/sven-production-parity-checklist-2026.md`
  - Row: `Read replica support (if scaling needed)`

## Implemented

- Added read-replica-aware DB access in gateway pool module:
  - `services/gateway-api/src/db/pool.ts`
  - New API:
    - `getReadPool()` (uses `DATABASE_READ_URL`, falls back to primary when unset)
    - `queryRead(...)`
  - Read pool env controls:
    - `PG_READ_POOL_MIN`, `PG_READ_POOL_MAX`
    - `PG_READ_POOL_CONNECTION_TIMEOUT_MS`, `PG_READ_POOL_IDLE_TIMEOUT_MS`
    - `PG_READ_STATEMENT_TIMEOUT_MS`

- Added runtime env wiring:
  - `.env`: `DATABASE_READ_URL` and read pool defaults.
  - `docker-compose.yml` (`gateway-api`): passes `DATABASE_READ_URL` + read pool env vars.

## Validation

1. Build:

```powershell
pnpm --dir services/gateway-api run build
```

2. Runtime smoke (primary + read pool):

```powershell
$env:DATABASE_URL='postgresql://sven:sven-dev-47@localhost:5432/sven'
$env:DATABASE_READ_URL='postgresql://sven:sven-dev-47@localhost:5432/sven'
pnpm --dir services/gateway-api exec tsx -e "import { getPool, getReadPool, closePool } from './src/db/pool.ts'; (async () => { await getPool().query('select 1'); await getReadPool().query('select 1'); await closePool(); })();"
```

Observed logs include:

- `Postgres pool created ...`
- `Postgres read pool created ...`
- `Postgres read pool closed`
- `Postgres pool closed`

3. Compose config includes read env:

```powershell
docker compose config | rg "DATABASE_READ_URL|PG_READ_POOL"
```

## Conclusion

- Gateway now supports optional read-replica routing without breaking single-DB deployments.
