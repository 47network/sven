# D4.7 Cross-Agent Knowledge Sharing - Phase 1 (2026-02-22)

## Scope

Implemented first-slice cross-agent knowledge sharing for RAG docs in `gateway-api` with:

- Persistence mapping for document shares across agent instances.
- Admin APIs to create/list/delete shares.
- Agent-aware retrieval scope in RAG search.
- Ingest support for owner/share metadata.
- Local e2e coverage for owner-only visibility and explicit sharing.

## Backend changes

- Migration:
  - `services/gateway-api/src/db/migrations/126_rag_agent_shares.sql`
  - Adds `rag_agent_shares` + org/doc/agent indexes.

- Routes:
  - `services/gateway-api/src/routes/admin/rag.ts`
  - Added:
    - `GET /v1/admin/rag/shares`
    - `POST /v1/admin/rag/shares`
    - `DELETE /v1/admin/rag/shares/:shareId`
  - Updated:
    - `POST /v1/admin/rag/search` accepts `agent_id` and applies scope:
      - ownerless docs
      - owner docs (`metadata.owner_agent_id`)
      - shared docs from `rag_agent_shares`
    - `POST /v1/admin/rag/ingest/multimodal` accepts:
      - `owner_agent_id`
      - `shared_with_agent_ids[]`
    - `POST /v1/admin/rag/ingest/structured` accepts:
      - `owner_agent_id`
      - `shared_with_agent_ids[]`

## Tests

- Added:
  - `services/gateway-api/src/__tests__/rag-agent-sharing.e2e.ts`
- Scenario:
  - ingest doc owned by agent A
  - verify agent B cannot retrieve it
  - create explicit share for agent B
  - verify agent B can retrieve it
  - delete share

## Notes

- This is a first slice for cross-agent RAG visibility control and share management.
- Future hardening can add stricter ownership validation against canonical agent registry if needed.
