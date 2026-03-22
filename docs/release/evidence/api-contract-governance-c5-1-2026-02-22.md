# C5.1 API Contract Governance (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

- Checklist target:
  - `docs/release/checklists/sven-production-parity-checklist-2026.md`
  - Rows:
    - `OpenAPI spec generated and versioned`
    - `Breaking change policy documented (semver on API version)`
    - `API versioning strategy: URL prefix /v1/, /v2/`
    - `Deprecation notices: 90 days before removal`

## Evidence Artifacts

1. OpenAPI spec file present and versioned:
- `docs/api/openapi.yaml`
- `openapi: 3.1.0`
- `info.version: 1.0.0`

2. Contract metadata/version check:
- `scripts/api-contract-version-check.cjs`
- Status outputs:
  - `docs/release/status/api-contract-version-latest.json`
  - `docs/release/status/api-contract-version-latest.md`

3. Versioning + breaking/deprecation policy document:
- `docs/api/versioning-and-deprecation-policy-2026.md`

## Commands Run

```powershell
node scripts/api-contract-version-check.cjs
rg -n "^openapi:|^  version:|^paths:" docs/api/openapi.yaml
rg -n "^## Versioning Strategy|^## Breaking Change Policy|^## Deprecation Policy|90 days|/v1/|/v2/" docs/api/versioning-and-deprecation-policy-2026.md
```

## Result

- Contract/version check script generated latest status artifacts successfully.
- OpenAPI spec and policy documentation are present and aligned with URL-major versioning + 90-day deprecation window.
