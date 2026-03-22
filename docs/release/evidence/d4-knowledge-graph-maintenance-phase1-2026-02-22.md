# D4.6 Evidence: Automatic Knowledge Graph Maintenance (Phase 1)

Date: 2026-02-22

## Scope

Implemented first automation slice for D4.6:

- Automatic duplicate consolidation
- Contradiction pruning
- Safe dry-run mode for previewing maintenance impact

## Backend Changes

- File:
  - `services/gateway-api/src/routes/admin/knowledge-graph.ts`

- New endpoint:
  - `POST /v1/admin/knowledge-graph/maintenance/run`
  - Body:
    - `dry_run?: boolean`
    - `max_merges?: number`

- Maintenance behavior:
  - Duplicate entity detection by normalized name + type
  - Auto-merge (target chosen by confidence/recency ordering)
  - Rewires:
    - `kg_relations` source/target IDs
    - `kg_evidence.entity_id`
  - Removes self-loop relations introduced by rewiring
  - De-duplicates identical relation triples (keep highest confidence)
  - Contradiction pruning on known opposite relation-type pairs (keep higher confidence)
  - Returns structured summary (`merged_entities`, `pruned_relations`, etc.)

## Tests

- Added:
  - `services/gateway-api/src/__tests__/knowledge-graph-maintenance.e2e.ts`
  - Verifies dry-run and live-run contract for maintenance endpoint.

- Executed:
  - `npm run --workspace @sven/gateway-api build` (pass)
  - `npm run --workspace @sven/gateway-api test -- knowledge-graph-maintenance.e2e.ts` (pass)

## Notes

- This is phase 1 automation with deterministic rules.
- Full D4.6 completion can extend with richer contradiction ontologies, scheduled jobs, and maintenance audit history UI.

