# D4.3 Evidence: Temporal RAG First Slice (Prefer Recent + Stale Flagging)

Date: 2026-02-22

## Scope

Implemented first production slice for D4.3:

- Time-aware retrieval controls for RAG search
- Stale-content flagging in results
- Recency-aware scoring adjustment

## Backend Changes

- File: `services/gateway-api/src/routes/admin/rag.ts`

- Enhanced endpoint:
  - `POST /v1/admin/rag/search`
  - New temporal request fields:
    - `prefer_recent: boolean`
    - `stale_after_days: number`
  - New temporal result fields:
    - `temporal.updated_at`
    - `temporal.age_days`
    - `temporal.is_stale`
    - `temporal.recency_boost`
  - Meta now includes:
    - `meta.temporal.prefer_recent`
    - `meta.temporal.stale_after_days`
    - `meta.temporal.stale_count`
  - Scoring now applies recency boost/penalty when `prefer_recent=true`.

- Ingest freshness support:
  - `POST /v1/admin/rag/ingest/multimodal` accepts `source_updated_at`
  - `POST /v1/admin/rag/ingest/structured` accepts `source_updated_at`
  - `source_updated_at` is validated and persisted in chunk metadata.

## Tests

- Added:
  - `services/gateway-api/src/__tests__/rag-temporal.e2e.ts`
  - Verifies temporal metadata exposure and stale-flag behavior contract.

- Executed:
  - `npm run --workspace @sven/gateway-api build` (pass)
  - `npm run --workspace @sven/gateway-api test -- rag-temporal.e2e.ts` (pass)

## Notes

- This is a first vertical slice for freshness-aware retrieval.
- Full D4.3 completion may include stronger decay strategies, source trust weighting by age, and stale-warning UX in Admin/Canvas surfaces.

