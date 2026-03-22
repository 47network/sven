# D2 Tenant RBAC Phase 2 (2026-02-22)

## Scope

Implemented tenant-scoped admin-role enforcement for active account context and added automated verification.

- Admin pre-handler hardening:
  - `services/gateway-api/src/routes/admin/index.ts`
  - `/v1/admin/*` now requires active tenant membership role in `owner|admin|operator`.
  - `member|viewer` are denied admin surface access.
  - Operator restrictions remain for sensitive prefixes (`users`, `accounts` management, `settings`, `permissions`), while allowing account self-service endpoints:
    - `GET /v1/admin/accounts`
    - `POST /v1/admin/accounts/:id/activate`
- Membership role support:
  - `services/gateway-api/src/routes/admin/accounts.ts`
  - Added `operator` as valid tenant membership role in member create flow.
  - Added membership update endpoint:
    - `PATCH /v1/admin/accounts/:id/members/:userId`
    - Supports role/status updates by tenant owner/admin.
- Request typing:
  - `services/gateway-api/src/types/fastify.d.ts`
  - Added `tenantRole` request annotation for downstream policy checks.
- Added/updated e2e tests:
  - `services/gateway-api/src/__tests__/tenant-rbac.e2e.ts`
  - `services/gateway-api/src/__tests__/tenant-isolation.e2e.ts` (path corrections to `/v1/admin/accounts/*`)

## Local verification

- `npm run --workspace @sven/gateway-api build` -> pass
- `npm run --workspace @sven/gateway-api test -- --runTestsByPath src/__tests__/tenant-rbac.e2e.ts src/__tests__/tenant-isolation.e2e.ts` -> pass

## Notes

- This phase establishes tenant-scoped role gates for admin surfaces.
- Full per-tenant RBAC matrix coverage across all non-admin surfaces remains future work.
