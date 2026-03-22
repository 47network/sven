# D3 Proactive Health Monitoring Phase 5 (2026-02-22)

## Scope

Implemented proactive connected-service health monitoring with issue reporting into chat.

- Added migration and rollback:
  - `services/gateway-api/src/db/migrations/123_proactive_health_issues.sql`
  - `services/gateway-api/src/db/rollbacks/123_proactive_health_issues.sql`
  - New table: `proactive_health_issues`
- Added Canvas proactive health endpoints:
  - `POST /v1/proactive/health/scan`
  - `GET /v1/proactive/health/issues`
- Health scan behavior:
  - Checks core service signals (`postgres`, `nats`).
  - Includes calendar sync error signal from user calendar accounts.
  - Supports deterministic simulated issue input from org setting.
  - Persists issue rollups and writes proactive assistant health alert messages to chat with notify cooldown.
- Added admin debug simulation endpoint:
  - `POST /v1/admin/debug/proactive-health/simulate`
  - Stores/removes org-scoped simulated issue payload under `proactive.health.simulatedIssue`.

## Files

- `services/gateway-api/src/routes/canvas.ts`
- `services/gateway-api/src/routes/admin/debug.ts`
- `services/gateway-api/src/db/migrations/123_proactive_health_issues.sql`
- `services/gateway-api/src/db/rollbacks/123_proactive_health_issues.sql`
- `services/gateway-api/src/__tests__/proactive-health-monitor.e2e.ts`
- `docs/release/checklists/sven-production-parity-checklist-2026.md`

## Local verification

- `npm run --workspace @sven/gateway-api build` -> pass
- `npm run --workspace @sven/gateway-api test -- --runTestsByPath src/__tests__/proactive-health-monitor.e2e.ts` -> pass

## Remaining

- Health checks currently focus on gateway-visible signals; deeper adapter/service-specific checks can be expanded.
- Per-channel user opt-in and quiet-hour suppression are not yet applied to health alerts.
