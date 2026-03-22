# A11 Search Engine Toggle Validation (2026-02-22)

- Checklist row: `A11 - Admin UI: engine toggle (SearXNG vs Brave vs both in A2.4)`

## Validation summary

Engine toggle is implemented via SearXNG engine selection in Admin UI and persisted backend settings.

## Code evidence

1. Admin UI engine toggle controls:
   - `apps/admin-ui/src/app/search-settings/page.tsx`
   - `ENGINE_OPTIONS` includes `brave`.
   - Checkbox list allows selecting any enabled engines set (including Brave-only or mixed).
2. Backend settings API for engine selection:
   - `services/gateway-api/src/routes/admin/search.ts`
   - `PUT /search/config` persists `search.engines`.
   - `POST /search/query` forwards selected engines to SearXNG using `engines=<csv>`.
3. Brave included in defaults:
   - `services/gateway-api/src/db/migrations/090_search_brave_default.sql`
   - Ensures `search.engines` contains `brave` by default or migration update.

## Notes

- This row is satisfied through SearXNG engine-level toggling rather than a separate standalone `search.brave` tool.
