# Performance Capacity Phase 1 Evidence (2026-02-14)

## Scope Completed

- Defined explicit throughput, latency, and headroom targets for release load gates.
- Implemented authenticated performance-capacity load test runner.
- Executed load tests against production-style domain (`app.sven.example.com`).
- Captured machine-readable and markdown status artifacts.

## Targets and Runner

- Targets doc: `docs/performance/performance-capacity-targets-2026.md`
- Gate runner: `scripts/performance-capacity-check.cjs`
- Ops wrapper: `scripts/ops/admin/run-performance-capacity-check.ps1`

## Runtime Result

Command run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/admin/run-performance-capacity-check.ps1 `
  -ApiUrl https://app.sven.example.com `
  -AdminUsername <admin> `
  -AdminPassword <admin_password> `
  -DurationSeconds 8 `
  -Concurrency 8
```

Result summary:

- Status: `pass`
- Aggregate: `21005` requests, `0` errors
- `chat_list`: `993.25 rps`, `p95=10ms`, `p99=12ms`, headroom `66.22x`
- `approvals_list`: `963 rps`, `p95=10ms`, `p99=11ms`, headroom `64.2x`
- `admin_metrics_summary`: `174.75 rps`, `p95=54ms`, `p99=60ms`, headroom `21.84x`
- `admin_queue_status`: `494.63 rps`, `p95=19ms`, `p99=22ms`, headroom `61.83x`

Artifacts:

- `docs/release/status/performance-capacity-latest.json`
- `docs/release/status/performance-capacity-latest.md`

## Notes

- Existing dashboard and mobile perf SLO status artifacts remain valid and are referenced for cross-surface latency context.

