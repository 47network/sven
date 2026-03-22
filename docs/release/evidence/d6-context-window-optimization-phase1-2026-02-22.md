# D6 Context Window Optimization (Phase 1) — 2026-02-22

## Scope
- Implement a local learning loop for compaction threshold recommendations per user conversation style.

## Implemented
- Migration:
  - `services/gateway-api/src/db/migrations/135_context_window_optimization.sql`
  - Added settings:
    - `ai.contextWindowOptimization.enabled` (`false`)
    - `ai.contextWindowOptimization.defaultThresholdPct` (`80`)
  - Added persistence:
    - `user_context_window_preferences` (applied user-level threshold/strategy)
    - `ai_context_window_recommendations` (generated suggestions + status)
- Admin endpoints:
  - `GET /v1/admin/performance/context-window/suggestions`
    - Analyzes recent org-scoped user message behavior and compaction events.
    - Computes per-user recommendation (`recommended_threshold_pct`, strategy, rationale).
    - Persists suggestion rows when schema is available.
  - `POST /v1/admin/performance/context-window/apply`
    - Applies recommendation to user-level preferences or global `chat.compaction.threshold_pct`.
    - Marks recommendation `applied` when `recommendation_id` is provided.
  - File: `services/gateway-api/src/routes/admin/performance.ts`

## Local Validation
- Command (run in `services/gateway-api`):
  - `npm run test -- --runTestsByPath src/__tests__/context-window-optimization.test.ts src/__tests__/auto-tuning.test.ts src/__tests__/meeting-assistant.test.ts src/__tests__/voice-call-integration.test.ts`
- Result:
  - `PASS src/__tests__/context-window-optimization.test.ts`
  - `PASS src/__tests__/auto-tuning.test.ts`
  - `PASS src/__tests__/meeting-assistant.test.ts`
  - `PASS src/__tests__/voice-call-integration.test.ts`
  - `9 passed, 0 failed`

## Notes
- Phase 1 delivers recommendation generation and apply persistence.
- Runtime consumption of user-specific thresholds can be added in a follow-up phase for tighter closed-loop behavior.
