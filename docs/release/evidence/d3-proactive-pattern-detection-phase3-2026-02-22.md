# D3 Proactive Pattern Detection Phase 3 (2026-02-22)

## Scope

Implemented recurring-question detection with proactive answer creation from local chat history.

- Added migration and rollback:
  - `services/gateway-api/src/db/migrations/121_proactive_pattern_insights.sql`
  - `services/gateway-api/src/db/rollbacks/121_proactive_pattern_insights.sql`
  - New table: `proactive_pattern_insights`
- Added Canvas proactive pattern APIs:
  - `POST /v1/proactive/patterns/scan`
  - `GET /v1/proactive/patterns`
- Scan behavior:
  - Reads user chat messages in active tenant scope.
  - Normalizes and groups repeated questions.
  - Upserts per-chat pattern insight records with occurrence/first-seen/last-seen.
  - Creates proactive assistant message when notify cooldown window allows.
  - Attempts LLM-generated concise answer (falls back to deterministic answer text if unavailable).

## Files

- `services/gateway-api/src/routes/canvas.ts`
- `services/gateway-api/src/db/migrations/121_proactive_pattern_insights.sql`
- `services/gateway-api/src/db/rollbacks/121_proactive_pattern_insights.sql`
- `services/gateway-api/src/__tests__/proactive-patterns.e2e.ts`
- `docs/release/checklists/sven-production-parity-checklist-2026.md`

## Local verification

- `npm run --workspace @sven/gateway-api build` -> pass
- `npm run --workspace @sven/gateway-api test -- --runTestsByPath src/__tests__/proactive-patterns.e2e.ts src/__tests__/proactive-schedules.e2e.ts src/__tests__/proactive-event-trigger.e2e.ts` -> pass

## Remaining

- Pattern clustering is lexical normalization based; semantic near-duplicate detection is still pending.
- No explicit user dismissal/feedback route for resolving insight cards yet.
