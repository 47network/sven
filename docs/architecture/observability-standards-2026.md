# Observability Standards (2026)

Date: 2026-02-14
Scope: gateway services, admin/canvas web apps, mobile app, desktop app, CLI.

## Signal Standards

- Logs: structured JSON with service name, severity, timestamp, correlation/request id.
- Metrics: p50/p95/p99 latency, throughput, error rate, queue depth, cache behavior.
- Traces: cross-service trace propagation for request paths touching auth, approvals, chat.

## Required Service Health Endpoints

- `GET /healthz` for liveness.
- `GET /readyz` for readiness.
- Role-gated operational endpoints for queue and performance status under `/v1/admin/performance/*`.

## Error Budget / Alert Baseline

- P0: sustained user-facing outage or auth/session breakage.
- P1: sustained degraded experience on core paths (auth/chat/approvals/admin metrics).
- P2: partial feature degradation with stable core operations.

- Error rate target (core API paths): `<= 5%` under release load profile.
- Alert should trigger on sustained breach windows, not single-sample spikes.

## Client Telemetry Baseline

- Mobile/Desktop/Web: capture crash events, API error rates, latency buckets.
- CLI: capture command failures and latency summaries (without secret payloads).
- Telemetry must redact sensitive fields before persistence/export.

## Operational Artifacts

- Performance capacity gate:
  - `docs/release/status/performance-capacity-latest.json`
- Admin dashboard SLO gate:
  - `docs/release/status/admin-dashboard-slo-latest.json`
- Observability/operability gate:
  - `docs/release/status/observability-operability-latest.json`
