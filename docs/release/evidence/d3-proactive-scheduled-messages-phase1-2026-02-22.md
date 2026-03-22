# D3 Proactive Scheduled Messages Phase 1 (2026-02-22)

## Scope

Implemented proactive scheduled message presets (daily briefing, daily digest, reminders) on top of existing scheduler execution.

- Added proactive scheduler endpoints in:
  - `services/gateway-api/src/routes/scheduler.ts`
  - `POST /v1/schedules/proactive`
  - `GET /v1/schedules/proactive`
  - `DELETE /v1/schedules/proactive/:id`
- Supported proactive preset types:
  - `daily_briefing`
  - `daily_digest`
  - `reminder`
- Preset creation behavior:
  - Accepts `time` (`HH:MM`) and `timezone`.
  - Generates recurring cron expression and next run.
  - Writes tasks into `scheduled_tasks` with proactive name marker.
  - Uses existing scheduler runtime (publishes scheduled task inbound event) for execution.

## Files

- `services/gateway-api/src/routes/scheduler.ts`
- `services/gateway-api/src/__tests__/proactive-schedules.e2e.ts`
- `docs/release/checklists/sven-production-parity-checklist-2026.md`

## Local verification

- `npm run --workspace @sven/gateway-api build` -> pass
- `npm run --workspace @sven/gateway-api test -- --runTestsByPath src/__tests__/proactive-schedules.e2e.ts` -> pass

## Remaining

- Event-triggered proactive actions are not implemented yet.
- Pattern detection and calendar-aware proactive enrichment are not implemented yet.
- Global `agent.proactive.enabled` and per-channel opt-in/quiet-hours controls remain pending.
