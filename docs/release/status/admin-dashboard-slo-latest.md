# Admin Dashboard SLO Check

Generated: 2026-02-14T00:51:50.584Z
API base: https://app.sven.example.com
Status: pass

## Aggregate
- requests: 32
- errors: 0
- error_rate: 0
- dashboard_p95_ms: 84
- dashboard_p99_ms: 84

## Checks
- [x] dashboard_p95: 84 <= 1500
- [x] dashboard_p99: 84 <= 2500
- [x] aggregate_error_budget: 0 <= 0.08
- [x] endpoint_error_rate:/healthz: 0 <= 0.1
- [x] endpoint_error_rate:/readyz: 0 <= 0.1
- [x] endpoint_error_rate:/v1/admin/approvals?status=pending&per_page=20: 0 <= 0.1
- [x] endpoint_error_rate:/v1/admin/runs?per_page=20: 0 <= 0.1
- [x] endpoint_error_rate:/v1/admin/incident/status: 0 <= 0.1

## Probes
- /healthz: success=8/8, error_rate=0, p95=84ms, p99=84ms
- /readyz: success=6/6, error_rate=0, p95=8ms, p99=8ms
- /v1/admin/approvals?status=pending&per_page=20: success=6/6, error_rate=0, p95=9ms, p99=9ms
- /v1/admin/runs?per_page=20: success=6/6, error_rate=0, p95=12ms, p99=12ms
- /v1/admin/incident/status: success=6/6, error_rate=0, p95=46ms, p99=46ms


