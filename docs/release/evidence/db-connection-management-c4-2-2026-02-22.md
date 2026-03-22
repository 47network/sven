# C4.2 Connection Management Baseline (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

- Checklist target:
  - `docs/release/checklists/sven-production-parity-checklist-2026.md`
  - Rows:
    - `Connection pool sized for expected load (min: 5, max: 20 per service)`
    - `Connection timeout: 5s`
    - `Idle connection reaping: 60s`
    - `Statement timeout: 30s for normal queries, 120s for reports`

## Implemented

- Gateway API pool config hardened:
  - `services/gateway-api/src/db/pool.ts`
  - `min`: `PG_POOL_MIN` default `5`
  - `max`: `PG_POOL_MAX` default `20`
  - `connectionTimeoutMillis`: `PG_POOL_CONNECTION_TIMEOUT_MS` default `5000`
  - `idleTimeoutMillis`: `PG_POOL_IDLE_TIMEOUT_MS` default `60000`
  - `statement_timeout` / `query_timeout`: `PG_STATEMENT_TIMEOUT_MS` default `30000`
  - Added report-query helper with elevated timeout:
    - `withReportClient(...)` sets `SET LOCAL statement_timeout` to
      `PG_REPORT_STATEMENT_TIMEOUT_MS` default `120000`

- Runtime env defaults added:
  - `.env`
    - `PG_POOL_MIN=5`
    - `PG_POOL_MAX=20`
    - `PG_POOL_CONNECTION_TIMEOUT_MS=5000`
    - `PG_POOL_IDLE_TIMEOUT_MS=60000`
    - `PG_STATEMENT_TIMEOUT_MS=30000`
    - `PG_REPORT_STATEMENT_TIMEOUT_MS=120000`
  - `docker-compose.yml` (`gateway-api` service env passthrough)

## Validation

1. Type/build validation:

```powershell
pnpm --dir services/gateway-api run build
```

2. Runtime pool config log validation:

```powershell
pnpm --dir services/gateway-api exec tsx -e "import { getPool, closePool } from './src/db/pool.ts'; (async () => { getPool(); await closePool(); })();"
```

Observed:

- `min: 5`
- `max: 20`
- `idleTimeoutMillis: 60000`
- `connectionTimeoutMillis: 5000`
- `statementTimeoutMillis: 30000`

## Conclusion

- Connection management defaults now match C4.2 target values in the main API database pool.
- Report queries have an explicit `120s` override path via `withReportClient`.
