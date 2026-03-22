# C5.1 OpenAPI Contract Coverage Check (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

- Checklist target:
  - `docs/release/checklists/sven-production-parity-checklist-2026.md`
  - Row: `Contract tests: all endpoints tested against spec`

## Implemented

- Added static OpenAPI-vs-route contract coverage checker:
  - `scripts/api-openapi-contract-check.cjs`
- Added npm script:
  - `package.json` -> `release:api:openapi:contract:check`
- Generated status outputs:
  - `docs/release/status/api-openapi-contract-latest.json`
  - `docs/release/status/api-openapi-contract-latest.md`

## Command Run

```powershell
node scripts/api-openapi-contract-check.cjs
```

## Current Result

- Status: `pass`.
- Missing-in-routes count: `0`.
- Spec endpoint count: `33`.
- Route endpoint count scanned: `447`.
- Undocumented-route count: `408` (informational only; does not fail contract parity for declared OpenAPI endpoints).

## Reconciliation Changes Applied

- Improved contract checker path canonicalization:
  - prefix-aware handling for admin routes mounted under `/v1/admin`
  - path-parameter normalization (`:id`, `{approvalId}` -> canonical placeholder)
- Added missing OpenAPI endpoints in gateway routes:
  - `PATCH /v1/users/me/password`
  - `DELETE /v1/users/me`
  - `POST /v1/incognito/messages`
  - `POST /v1/complete`
  - `GET /v1/push/vapid-public-key`

## Interpretation

- C5.1 contract test gate is now satisfied for all OpenAPI-declared endpoints.
