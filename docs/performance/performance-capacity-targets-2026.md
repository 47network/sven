# Performance and Capacity Targets (2026)

Date: 2026-02-14
Scope: Gateway admin/API operational load gates for release readiness.

## Throughput Targets

- `chat_list` (`GET /v1/admin/chats?per_page=20`)
  - minimum throughput: `15 rps`
  - latency budget: `p95 <= 700ms`, `p99 <= 1200ms`
- `approvals_list` (`GET /v1/admin/approvals?status=pending&per_page=20`)
  - minimum throughput: `15 rps`
  - latency budget: `p95 <= 700ms`, `p99 <= 1200ms`
- `admin_metrics_summary` (`GET /v1/admin/performance/metrics/summary`)
  - minimum throughput: `8 rps`
  - latency budget: `p95 <= 1200ms`, `p99 <= 2000ms`
- `admin_queue_status` (`GET /v1/admin/performance/queue-status`)
  - minimum throughput: `8 rps`
  - latency budget: `p95 <= 900ms`, `p99 <= 1500ms`

## Capacity Headroom Rule

- Each scenario must achieve at least `1.25x` headroom over minimum throughput target.
- Error rate per scenario must remain `<= 5%`.

## Standard Test Profile

- Duration per scenario: `8s`
- Concurrency: `8`
- Runner:
  - `npm run release:performance:capacity:auth -- -ApiUrl https://app.example.com -AdminUsername <user> -AdminPassword <pass>`

## Artifacts

- `docs/release/status/performance-capacity-latest.json`
- `docs/release/status/performance-capacity-latest.md`
- `docs/release/evidence/performance-capacity-phase1-2026-02-14.md`

