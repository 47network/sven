# D2 Tenant Storage Phase 3 (2026-02-22)

## Scope

Implemented schema-per-tenant provisioning scaffolding and storage mapping controls.

- Added migration:
  - `services/gateway-api/src/db/migrations/119_tenant_storage_mapping.sql`
  - New table: `tenant_storage_mapping`
  - Tracks per-organization storage mode:
    - `shared_schema`
    - `dedicated_schema`
    - `dedicated_database` (metadata placeholder)
- Account provisioning updates:
  - `services/gateway-api/src/routes/admin/accounts.ts`
  - On account create, writes default storage mapping.
  - Attempts dedicated schema auto-provision (`CREATE SCHEMA IF NOT EXISTS tenant_<slug>`) with safe fallback to shared mode if schema create is unavailable.
- Storage admin APIs:
  - `GET /v1/admin/accounts/:id/storage`
  - `PUT /v1/admin/accounts/:id/storage`
  - Owner/admin can view/update storage mode, schema name, and connection metadata.
- Safety:
  - Schema names are normalized and validated against strict identifier pattern before provisioning.

## Verification

- New e2e:
  - `services/gateway-api/src/__tests__/tenant-storage.e2e.ts`
  - Verifies mapping exists after account create and can be updated to dedicated schema mode.
- Full D2 e2e set run:
  - `tenant-storage.e2e.ts`
  - `tenant-rbac.e2e.ts`
  - `tenant-isolation.e2e.ts`

## Local results

- `npm run --workspace @sven/gateway-api build` -> pass
- `npm run --workspace @sven/gateway-api test -- --runTestsByPath src/__tests__/tenant-storage.e2e.ts src/__tests__/tenant-rbac.e2e.ts src/__tests__/tenant-isolation.e2e.ts` -> pass

## Remaining

- Not yet full physical isolation migration of runtime data into per-tenant schemas.
- Dedicated-database connection orchestration still metadata-only (no live per-tenant DSN switching yet).
