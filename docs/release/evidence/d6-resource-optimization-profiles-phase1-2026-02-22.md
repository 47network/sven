# D6 Resource Optimization Profiles (Phase 1) — 2026-02-22

## Scope
- Implement profile auto-switching primitives based on time windows and usage pressure.

## Implemented
- Migration:
  - `services/gateway-api/src/db/migrations/138_resource_optimization_profiles.sql`
  - Added settings:
    - `ai.resourceOptimization.enabled` (`false`)
    - `ai.resourceOptimization.defaultTimezone` (`UTC`)
  - Added persistence:
    - `ai_resource_profile_rules` (switch rules)
    - `ai_resource_profile_switch_events` (switch history)
- Admin endpoints:
  - `POST /v1/admin/performance/resource-optimization/rules`
    - Create `time_window` or `queue_pressure` rules targeting a profile.
  - `GET /v1/admin/performance/resource-optimization/rules`
    - List org rules ordered by enabled/priority.
  - `POST /v1/admin/performance/resource-optimization/evaluate`
    - Evaluates active rules against current UTC hour and recent queue depth.
    - Supports dry-run (default) and apply mode (`dry_run=false`) to switch active profile.
    - Logs switch events on applied transitions.
  - File: `services/gateway-api/src/routes/admin/performance.ts`

## Local Validation
- Command (run in `services/gateway-api`):
  - `npm run test -- --runTestsByPath src/__tests__/resource-optimization-profiles.test.ts src/__tests__/prompt-refinement-ab.test.ts src/__tests__/tool-selection-optimization.test.ts src/__tests__/context-window-optimization.test.ts src/__tests__/auto-tuning.test.ts`
- Result:
  - `PASS src/__tests__/resource-optimization-profiles.test.ts`
  - `PASS src/__tests__/prompt-refinement-ab.test.ts`
  - `PASS src/__tests__/tool-selection-optimization.test.ts`
  - `PASS src/__tests__/context-window-optimization.test.ts`
  - `PASS src/__tests__/auto-tuning.test.ts`
  - `10 passed, 0 failed`

## Notes
- Phase 1 provides rule creation, evaluation, and profile switch logging.
- Scheduled evaluation (e.g., cron-driven) can be added in follow-up for autonomous continuous optimization.
