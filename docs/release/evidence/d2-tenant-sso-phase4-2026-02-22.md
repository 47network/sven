# D2 Tenant SSO Phase 4 (2026-02-22)

## Scope

Implemented tenant-scoped SSO configuration and local SSO flow scaffolding with fallback local auth preserved.

- Admin SSO config API:
  - `GET /v1/admin/settings/sso`
  - `PUT /v1/admin/settings/sso`
  - Stores tenant config in `organization_settings` key `auth.sso.config`.
  - Supports:
    - global enable/fallback flag
    - OIDC provider settings
    - SAML provider settings
    - JIT provisioning defaults
    - basic group mapping structure
  - Sensitive fields are redacted on reads (`client_secret`, `cert_pem`).
- Auth SSO status endpoint:
  - `GET /v1/auth/sso/status`
  - Returns provider enablement and redacted effective config for active tenant context.
  - Explicitly reports local auth availability (`local_auth_available: true`).
- Mock SSO login endpoint (local/dev integration path):
  - `POST /v1/auth/sso/mock/login`
  - Guarded by env flag: `SVEN_SSO_MOCK_ENABLED=true`.
  - Validates tenant SSO enablement and provider enablement.
  - Performs JIT user provisioning + membership upsert using tenant default role.
  - Issues access/refresh sessions and sets auth cookies, preserving existing local-auth flows.

## Files

- `services/gateway-api/src/routes/admin/settings.ts`
- `services/gateway-api/src/routes/auth.ts`
- `services/gateway-api/src/__tests__/tenant-sso.e2e.ts`

## Local verification

- `npm run --workspace @sven/gateway-api build` -> pass
- `npm run --workspace @sven/gateway-api test -- --runTestsByPath src/__tests__/tenant-sso.e2e.ts src/__tests__/tenant-storage.e2e.ts src/__tests__/tenant-rbac.e2e.ts src/__tests__/tenant-isolation.e2e.ts` -> pass

## Remaining

- Real OIDC discovery/token exchange and real SAML assertion consumer flow.
- Group mapping enforcement into tenant role assignment beyond default role fallback.
- Enterprise IdP specific wiring (Okta/Azure AD/Keycloak) and full production hardening.
