# Load Test Evidence: C1.1 Remediation Pass (2026-02-21)

## Scope

- Checklist section: `C1.1 Load Testing`
- Script: `tests/load/gateway-load-test.js`
- Output artifact: `docs/performance/load-test-results.json`

## Remediation Applied

- Health/readiness probe DB load reduction:
  - `services/gateway-api/src/routes/health.ts`
  - Added short TTL health cache + in-flight dedupe and reused it for `/readyz`.
- DB pool tunability and safer defaults:
  - `services/gateway-api/src/db/pool.ts`
  - `PG_POOL_MAX`, `PG_POOL_IDLE_TIMEOUT_MS`, `PG_POOL_CONNECTION_TIMEOUT_MS`.
- Load profile endpoint corrections:
  - `tests/load/gateway-load-test.js`
  - Replaced stale admin endpoints with valid registered admin routes.
  - Error threshold now uses semantic `error_rate` instead of raw `http_req_failed`.

## Command

```powershell
docker run --rm -v "${PWD}:/work" -w /work grafana/k6 run `
  --env BASE_URL=http://host.docker.internal:3000 `
  --env COOKIE="sven_session=<admin-session>" `
  --env ADAPTER_TOKEN="sven-local-dev-adapter-token-change-me-in-production" `
  tests/load/gateway-load-test.js
```

## Result Summary

- Run status: **pass** for non-LLM latency + 5xx + semantic error rate gates
- `http_req_duration.p(95)`: `2.92ms` (target `<500ms`)
- `errors_5xx.count`: `0` (target `0`)
- `error_rate`: `0.00%` (target `<0.1%`)
- Max VUs reached: `100`
- Concurrent chat sessions reached: `10`
- LLM first-token probe: **not run** (no `OPENAI_API_KEY` + `OPENAI_MODEL`)
- 24h RSS stability: **pending separate long-run**

