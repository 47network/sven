# A11 `search.brave` Tool Validation (2026-02-22)

- Checklist row: `A11 - OR: Add search.brave tool as alternative to search.web (API key config)`

## Implemented

1. Skill runner tool execution path:
   - `services/skill-runner/src/index.ts`
   - Added `case 'search.brave'` with:
     - input validation (`query`, optional `num_results`, `language`, `country`)
     - Brave API call: `https://api.search.brave.com/res/v1/web/search`
     - safe-search mapping from `search.safeSearch`
     - result URL sanitization + ad filtering
     - output shape aligned with `search.web` (`title/url/snippet/source_engine`)
2. API key configuration:
   - Reads `search.brave.api_key_ref` from `settings_global` (secret reference via existing secret resolver), fallback to `BRAVE_SEARCH_API_KEY` environment variable.
3. Tool registry migration:
   - `services/gateway-api/src/db/migrations/115_search_brave_tool.sql`
   - Registers first-party trusted tool `search.brave` with JSON schemas and `search.brave` permission scope.

## Local validation

Commands run:

```powershell
pnpm --dir services/skill-runner run build
pnpm --dir services/gateway-api run build
```

Observed:

- Both builds completed successfully.

## Notes

- Runtime usage requires a configured API key:
  - `search.brave.api_key_ref` (preferred secret-ref path), or
  - `BRAVE_SEARCH_API_KEY` env var.
