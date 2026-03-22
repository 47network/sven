# D6 Tool Selection Optimization (Phase 1) — 2026-02-22

## Scope
- Add local learning and persistence for selecting preferred tools based on historical success for similar intents.

## Implemented
- Migration:
  - `services/gateway-api/src/db/migrations/136_tool_selection_optimization.sql`
  - Added settings:
    - `ai.toolSelectionOptimization.enabled` (`false`)
    - `ai.toolSelectionOptimization.minSamples` (`5`)
  - Added persistence:
    - `ai_tool_selection_preferences` (applied intent → preferred tool mappings)
    - `ai_tool_selection_recommendations` (generated recommendations)
- Admin endpoints:
  - `GET /v1/admin/performance/tool-selection/suggestions`
    - Aggregates `tool_runs` by derived `intent_key` and `tool_name`.
    - Scores candidates by success rate, then latency and sample count.
    - Emits + stores recommendation payloads when schema exists.
  - `POST /v1/admin/performance/tool-selection/apply`
    - Applies recommendation or explicit `intent_key` + `tool_name`.
    - Upserts `ai_tool_selection_preferences`.
    - Marks source recommendation as applied.
  - File: `services/gateway-api/src/routes/admin/performance.ts`

## Local Validation
- Command (run in `services/gateway-api`):
  - `npm run test -- --runTestsByPath src/__tests__/tool-selection-optimization.test.ts src/__tests__/context-window-optimization.test.ts src/__tests__/auto-tuning.test.ts src/__tests__/meeting-assistant.test.ts src/__tests__/voice-call-integration.test.ts`
- Result:
  - `PASS src/__tests__/tool-selection-optimization.test.ts`
  - `PASS src/__tests__/context-window-optimization.test.ts`
  - `PASS src/__tests__/auto-tuning.test.ts`
  - `PASS src/__tests__/meeting-assistant.test.ts`
  - `PASS src/__tests__/voice-call-integration.test.ts`
  - `11 passed, 0 failed`

## Notes
- Phase 1 delivers recommendation generation and preference persistence.
- Runtime preference consumption for automatic tool ordering can be added as follow-up for full closed-loop behavior.
