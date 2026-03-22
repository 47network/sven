# Evidence: API Input Validation Hardening (C5.3)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C5.3`

## Implemented

- Added shared validation helpers:
  - `services/gateway-api/src/lib/input-validation.ts`
  - UUID validator (`isUuid`)
  - Slug validator (`isSlug`)
  - Search query normalization and unsafe-pattern checks (`normalizeSearchQuery`, `isSafeSearchQuery`)
- Added path parameter validation (UUID + slug):
  - `services/gateway-api/src/routes/admin/performance.ts`
  - `GET /performance/rag-indexing/stats/:sourceId` now returns `400` for non-UUID `sourceId`
  - `GET /performance/rag-indexing/files/:sourceId` now returns `400` for non-UUID `sourceId`
  - `PUT /performance/profiles/:profileName/activate` now returns `400` for invalid slug values
- Added query sanitization for search:
  - `services/gateway-api/src/routes/admin/search.ts`
  - `POST /search/query` now normalizes whitespace/control chars and rejects unsafe SQL/XSS-like patterns

## Test Alignment

- Updated E2E expectation for invalid UUID path input:
  - `services/gateway-api/src/__tests__/performance.e2e.ts`
  - Invalid `sourceId` now expects error response, matching new validation behavior.

## Notes

- `File upload size limits enforced (50MB default)` remains open and is not part of this evidence file.
