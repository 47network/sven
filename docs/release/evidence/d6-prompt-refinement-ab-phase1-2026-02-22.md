# D6 Prompt Refinement A/B (Phase 1) — 2026-02-22

## Scope
- Implement local A/B experimentation primitives for prompt variants and response quality measurement.

## Implemented
- Migration:
  - `services/gateway-api/src/db/migrations/137_prompt_refinement_ab.sql`
  - Added settings:
    - `ai.promptRefinement.enabled` (`false`)
    - `ai.promptRefinement.defaultMetric` (`quality_score`)
  - Added tables:
    - `ai_prompt_experiments` (experiment config + variants)
    - `ai_prompt_experiment_runs` (variant assignments + quality/latency observations)
- Admin endpoints:
  - `POST /v1/admin/performance/prompt-refinement/experiments`
    - Creates active A/B experiment with variant prompts and target sample size.
  - `POST /v1/admin/performance/prompt-refinement/assign`
    - Deterministic A/B assignment based on experiment/chat/user hash.
    - Logs run row with prompt hash and metadata.
  - `POST /v1/admin/performance/prompt-refinement/feedback`
    - Records quality score for a run.
  - `GET /v1/admin/performance/prompt-refinement/experiments/:id/summary`
    - Computes per-variant sample count, average quality, average latency, and winner.
  - File: `services/gateway-api/src/routes/admin/performance.ts`

## Local Validation
- Command (run in `services/gateway-api`):
  - `npm run test -- --runTestsByPath src/__tests__/prompt-refinement-ab.test.ts src/__tests__/tool-selection-optimization.test.ts src/__tests__/context-window-optimization.test.ts src/__tests__/auto-tuning.test.ts`
- Result:
  - `PASS src/__tests__/prompt-refinement-ab.test.ts`
  - `PASS src/__tests__/tool-selection-optimization.test.ts`
  - `PASS src/__tests__/context-window-optimization.test.ts`
  - `PASS src/__tests__/auto-tuning.test.ts`
  - `8 passed, 0 failed`

## Notes
- Phase 1 provides experimentation, assignment, feedback, and summary foundations.
- Runtime-side prompt selection from active experiments can be added in follow-up for full closed-loop rollout.
