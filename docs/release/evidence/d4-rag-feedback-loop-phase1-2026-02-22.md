# D4.4 Evidence: RAG Feedback Loop First Slice (User Corrections -> Ranking Signals)

Date: 2026-02-22

## Scope

Implemented first production slice for D4.4:

- Capture user retrieval feedback on RAG chunks
- Aggregate feedback signals
- Apply feedback-derived ranking adjustment during search

## Backend Changes

- Migration and rollback:
  - `services/gateway-api/src/db/migrations/125_rag_retrieval_feedback.sql`
  - `services/gateway-api/src/db/rollbacks/125_rag_retrieval_feedback.sql`

- File: `services/gateway-api/src/routes/admin/rag.ts`

- New endpoints:
  - `POST /v1/admin/rag/feedback`
    - Accepts `chunk_id`, `signal` (`positive|negative|correction`), optional `correction_text`, `weight`, metadata.
  - `GET /v1/admin/rag/feedback/summary?chunk_id=...`
    - Returns aggregated feedback by signal for a chunk.

- Search integration:
  - `POST /v1/admin/rag/search` now:
    - Loads chunk feedback aggregates
    - Computes bounded boost/penalty from feedback history
    - Applies this signal to combined ranking score
    - Returns per-result `feedback` block:
      - `positive`, `negative`, `correction`, `net`, `boost`
    - Returns meta:
      - `feedback.adjusted_count`

## Tests

- Added:
  - `services/gateway-api/src/__tests__/rag-feedback.e2e.ts`
  - Verifies feedback submission, summary availability, and feedback signal presence in subsequent retrieval.

- Executed:
  - `npm run --workspace @sven/gateway-api build` (pass)
  - `npm run --workspace @sven/gateway-api test -- rag-feedback.e2e.ts` (pass)

## Notes

- This is a first vertical slice for feedback-driven retrieval adaptation.
- Full D4.4 completion can extend to query-level correction synthesis, automated re-index hints, and UX workflows for correction review.

