# D3 Phase 6 Evidence: Proactive Controls (Admin Gate, Channel Opt-In, Quiet Hours)

Date: 2026-02-22

## Scope

Implemented checklist items:

- Admin setting: `agent.proactive.enabled` (default false, opt-in)
- User setting: per-channel proactive opt-in/out
- Quiet hours suppression for proactive delivery

## Backend Changes

- Migration and rollback:
  - `services/gateway-api/src/db/migrations/124_proactive_preferences.sql`
  - `services/gateway-api/src/db/rollbacks/124_proactive_preferences.sql`
- Added default global setting insert:
  - `agent.proactive.enabled = false`
- Added table:
  - `user_proactive_preferences(user_id, channels, quiet_hours_start, quiet_hours_end, quiet_hours_timezone, updated_at)`

- Proactive preference APIs:
  - `GET /v1/proactive/preferences`
  - `PUT /v1/proactive/preferences`
  - File: `services/gateway-api/src/routes/canvas.ts`

- Delivery gating integrated into proactive flows:
  - Pattern scan notify path (`POST /v1/proactive/patterns/scan`)
  - Calendar prefetch notify path (`POST /v1/proactive/calendar/prefetch`)
  - Health scan notify path (`POST /v1/proactive/health/scan`)
  - HA event simulation notify path (`POST /v1/admin/ha/subscriptions/:id/simulate`)
  - Files:
    - `services/gateway-api/src/routes/canvas.ts`
    - `services/gateway-api/src/routes/admin/ha-subscriptions.ts`

## Behavior

- If `agent.proactive.enabled` is false (or missing), proactive messages are suppressed.
- If user channel preference is false for target channel, proactive messages are suppressed.
- If quiet hours are active in user timezone, proactive messages are suppressed.
- Suppression reasons are returned as structured fields where applicable:
  - `admin_disabled`
  - `channel_opted_out`
  - `quiet_hours`

## Validation

- Build:
  - `npm run --workspace @sven/gateway-api build` (pass)
- Targeted tests:
  - `npm run --workspace @sven/gateway-api test -- proactive-patterns.e2e.ts proactive-calendar-prefetch.e2e.ts proactive-health-monitor.e2e.ts proactive-event-trigger.e2e.ts proactive-preferences.e2e.ts` (all pass)

- New test:
  - `services/gateway-api/src/__tests__/proactive-preferences.e2e.ts`
  - Verifies suppression by admin gate disabled, channel opt-out, and quiet hours, and resumed delivery after preferences allow.
