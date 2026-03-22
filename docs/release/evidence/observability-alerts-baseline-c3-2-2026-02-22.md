# C3.2 Alerts Baseline (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Source

- `config/prometheus-alerts.yml`

## Implemented Alert Rules Mapped to Checklist

- Error rate > 5% for 5m -> present
  - `SvenHighErrorRate` (`for: 5m`, severity `critical`)
- NATS consumer lag > 1000 -> present
  - `SvenNatsConsumerLag` (`for: 5m`, severity `warning`)
- Postgres pool > 80% -> present
  - `SvenPostgresPoolExhaustion` (`for: 5m`, severity `warning`)
- Service restart -> present
  - `SvenServiceRestart` (severity `info`)
- Disk usage >85 warn / >95 page -> present
  - `SvenDiskUsageWarning` and `SvenDiskUsageCritical`
- Kill switch / lockdown activated -> page -> present
  - `SvenIncidentModeActive` (`for: 1m`, severity `critical`)
  - Expression: `sven_incident_mode_active{job="gateway-api",mode=~"kill_switch|lockdown"} == 1`
  - Source metric emitted by gateway `/metrics` route:
    - `sven_incident_mode_active{mode="normal|kill_switch|lockdown|forensics"}`

## Local Verification

- Source build:
  - `pnpm --dir services/gateway-api run build` -> pass
- Local container rebuild and restart:
  - `docker compose build gateway-api` -> pass
  - `docker compose up -d gateway-api` -> pass
- Runtime metric verification (inside running container):
  - `docker exec sven_v010-gateway-api-1 node -e "fetch('http://localhost:3000/metrics')..."` confirmed:
    - metric family exists (`HAS_INCIDENT_METRIC=true`)
    - baseline state:
      - `sven_incident_mode_active{mode="normal"} 1`
  - Updated local DB setting (`incident.mode`) to `lockdown` via postgres container and re-read metrics:
    - `sven_incident_mode_active{mode="lockdown"} 1`
  - Restored `incident.mode` to `normal` after check.

## Partial / Gaps

- p95 latency rule updated to full checklist alignment:
  - `SvenHighP95Latency` now compares short-window p95 (5m) against `2x` long-window baseline p95 (1h), with `for: 10m`.
  - Expression now uses:
    - `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{job="gateway-api"}[5m])))`
    - `2 * clamp_min(histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{job="gateway-api"}[1h]))), 0.05)`
