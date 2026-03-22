# C5.3 Request Body Schema Coverage (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

- Checklist target:
  - `docs/release/checklists/sven-production-parity-checklist-2026.md`
  - Row: `All request bodies validated against JSON schema`

## Implemented

- Added request-body schema coverage checker:
  - `scripts/api-request-body-schema-coverage-check.cjs`
- Added npm script:
  - `package.json` -> `release:api:request-schema:coverage:check`
- Generated status files:
  - `docs/release/status/api-request-body-schema-coverage-latest.json`
  - `docs/release/status/api-request-body-schema-coverage-latest.md`

## Command Run

```powershell
node scripts/api-request-body-schema-coverage-check.cjs
```

## Current Result

- Status: `pass`.
- Expected request-body routes (OpenAPI): `20`
- Validated count: `20`
- Missing count: `0`
- Missing-route count: `0`

## Coverage Improvements Applied

- Checker scoped to OpenAPI request-body endpoints and made prefix/param canonical:
  - admin route prefix resolution (`/v1/admin`)
  - normalized path params for matching
- Added JSON schema request bodies to all previously-missing OpenAPI routes:
  - auth: `/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout`, `/v1/auth/logout-all`
  - canvas: `/v1/chats`, `/v1/chats/:chatId`, `/v1/chats/:chatId/messages`, `/v1/chats/:chatId/share`, `/v1/approvals/:id/vote`
  - deployment: `/v1/config/deployment/setup`
  - admin devices: `POST /v1/admin/devices`, `PATCH /v1/admin/devices/:id`, `POST /v1/admin/devices/:id/pair/confirm`, `POST /v1/admin/devices/:id/command`
  - push: `/v1/push/register`, `/v1/push/unregister`
  - preferences: `PUT /v1/me/ui-preferences`
  - newly-added OpenAPI endpoints: `/v1/users/me/password`, `/v1/incognito/messages`, `/v1/complete`

## Interpretation

- C5.3 JSON-schema validation gate is now satisfied for all OpenAPI-declared request-body endpoints.
