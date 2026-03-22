# D4.1 Evidence: Multi-Modal RAG First Slice (Transcript Ingest + Filtered Search)

Date: 2026-02-22

## Scope

Implemented first production slice for D4.1:

- Ingest transcript content for media sources (`image`, `audio`, `video`)
- Search with source-type and modality filters

## Backend Changes

- File: `services/gateway-api/src/routes/admin/rag.ts`

- New endpoint:
  - `POST /v1/admin/rag/ingest/multimodal`
  - Request supports:
    - `source`
    - `source_type` (`image|audio|video`)
    - `transcript`
    - optional `transcript_language`
    - optional ACL (`visibility`, `allow_users`, `allow_chats`)
    - optional `metadata` and `doc_id`
  - Behavior:
    - Transcript chunking
    - Per-chunk insert into `rag_embeddings`
    - Best-effort vector embedding generation
    - Best-effort OpenSearch chunk indexing

- Enhanced endpoint:
  - `POST /v1/admin/rag/search`
  - New filters:
    - `source_types: string[]`
    - `modalities: string[]`
  - Filters applied to both:
    - OpenSearch BM25 query path
    - Postgres vector query path
  - Vector-only results now recover text from `metadata.chunk_text` when needed.

## Tests

- Added:
  - `services/gateway-api/src/__tests__/rag-multimodal.e2e.ts`
  - Validates ingest contract and filtered search contract.

- Executed:
  - `npm run --workspace @sven/gateway-api build` (pass)
  - `npm run --workspace @sven/gateway-api test -- rag-multimodal.e2e.ts` (pass)

## Notes

- This is a first vertical slice (transcript-driven multimodal retrieval).
- Full D4.1 completion still requires broader ingestion pipelines for binary assets and richer multimodal ranking.

