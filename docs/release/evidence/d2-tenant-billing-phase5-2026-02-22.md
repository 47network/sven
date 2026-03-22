# D2 Tenant Billing / Usage Metering Phase 5 (2026-02-22)

## Scope

Implemented tenant-level billing and usage metering scaffolding with account-scoped rollups.

- Added migration:
  - `services/gateway-api/src/db/migrations/120_tenant_usage_metering.sql`
  - New table: `tenant_usage_events`
  - Captures usage source/metric, quantity, per-unit cost, total cost, and optional user/session/model context.
- Added rollback:
  - `services/gateway-api/src/db/rollbacks/120_tenant_usage_metering.sql`
- Added account usage APIs in:
  - `services/gateway-api/src/routes/admin/accounts.ts`
  - `POST /v1/admin/accounts/:id/usage/events`
  - `GET /v1/admin/accounts/:id/usage/summary?days=N`
  - `GET /v1/admin/accounts/:id/usage/daily?days=N`
- Billing summary combines:
  - Tenant meter ledger (`tenant_usage_events`)
  - Existing LLM cost ledger (`model_usage_logs`)
  - Includes source and model breakdowns for admin reporting.
- Access control:
  - Usage endpoints restricted to account `owner/admin`.
  - Viewer/member/operator paths are denied for metering management/view.

## Files

- `services/gateway-api/src/db/migrations/120_tenant_usage_metering.sql`
- `services/gateway-api/src/db/rollbacks/120_tenant_usage_metering.sql`
- `services/gateway-api/src/routes/admin/accounts.ts`
- `services/gateway-api/src/__tests__/tenant-billing.e2e.ts`

## Local verification

- `npm run --workspace @sven/gateway-api build` -> pass
- `npm run --workspace @sven/gateway-api test -- --runTestsByPath src/__tests__/tenant-billing.e2e.ts` -> pass
- `npm run --workspace @sven/gateway-api test -- --runTestsByPath src/__tests__/tenant-isolation.e2e.ts src/__tests__/tenant-rbac.e2e.ts src/__tests__/tenant-storage.e2e.ts src/__tests__/tenant-sso.e2e.ts src/__tests__/tenant-billing.e2e.ts` -> pass

## Remaining

- No invoice generation/payment-processor integration yet.
- No tenant billing plan/rate-card configuration surface yet.
- Meter emission from all runtime subsystems is not fully wired (current API is ready for ingestion).
