# D4.2 Evidence: Structured Data RAG First Slice (Rows Ingest + Filtered Search)

Date: 2026-02-22

## Scope

Implemented first production slice for D4.2:

- Ingest structured records from database/spreadsheet/API style payloads
- Retrieve with structured modality and source-type filters

## Backend Changes

- File: `services/gateway-api/src/routes/admin/rag.ts`

- New endpoint:
  - `POST /v1/admin/rag/ingest/structured`
  - Request supports:
    - `source`
    - `source_type` (`database|spreadsheet|api`)
    - `dataset_name` (optional)
    - `rows` (array of objects)
    - optional ACL (`visibility`, `allow_users`, `allow_chats`)
    - optional `metadata` and `doc_id`
  - Behavior:
    - Normalizes rows into canonical key/value text lines
    - Chunks content
    - Inserts into `rag_embeddings`
    - Best-effort vector embedding generation
    - Best-effort OpenSearch chunk indexing
    - Tags metadata with `modality: structured` and `structured_source_type`

- Search support:
  - `POST /v1/admin/rag/search` already supports:
    - `source_types[]`
    - `modalities[]`
  - Structured ingest is retrievable via:
    - `source_types: ['database'|'spreadsheet'|'api']`
    - `modalities: ['structured']`

## Tests

- Added:
  - `services/gateway-api/src/__tests__/rag-structured.e2e.ts`
  - Validates ingest contract and filtered search contract.

- Executed:
  - `npm run --workspace @sven/gateway-api build` (pass)
  - `npm run --workspace @sven/gateway-api test -- rag-structured.e2e.ts` (pass)

## Notes

- This is a first vertical slice focused on normalized structured rows.
- Full D4.2 completion still requires direct live connectors/query orchestration across real DBs/spreadsheets/APIs.

