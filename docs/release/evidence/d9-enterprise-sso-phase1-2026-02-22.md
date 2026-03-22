# D9 Enterprise SSO - Phase 1 (2026-02-22)

## Scope

Convert existing tenant-scoped SSO backend groundwork into operator-usable admin controls, with safe secret handling and validation.

## Implemented

- Admin UI SSO configuration page:
  - `apps/admin-ui/src/app/sso/page.tsx`
  - Supports:
    - global SSO enable/fallback toggle
    - OIDC provider fields (issuer/client/scopes/endpoints/callback)
    - SAML provider fields (entrypoint/entity/cert/callback)
    - JIT provisioning defaults
    - group mapping JSON editor

- Admin navigation wiring:
  - `apps/admin-ui/src/components/layout/Sidebar.tsx`
  - Added `Security -> SSO` route (`/sso`).

- Admin API + hooks for SSO settings:
  - `apps/admin-ui/src/lib/api.ts`
    - `settings.getSso()`
    - `settings.setSso(payload)`
    - `SsoConfig` types
  - `apps/admin-ui/src/lib/hooks.ts`
    - `useSsoSettings()`
    - `useSetSsoSettings()`

- Backend safety improvement for redacted secrets:
  - `services/gateway-api/src/routes/admin/settings.ts`
  - `PUT /v1/admin/settings/sso` now preserves existing secret values when client submits redacted placeholders:
    - OIDC `client_secret === "***"` -> keep previous stored value
    - SAML `cert_pem === "***"` -> keep previous stored value

## Validation

- `pnpm --dir apps/admin-ui run typecheck` succeeded.
- `pnpm --dir services/gateway-api run build` succeeded.
- `pnpm --dir services/gateway-api run test -- --runInBand src/__tests__/tenant-sso.e2e.ts` succeeded.

## 2026-02-23 Incremental Update

- `services/gateway-api/src/routes/auth.ts`
  - SSO config sanitizer now includes `group_mapping` for auth-side evaluation.
  - `/v1/auth/sso/mock/login` now accepts optional `groups` claim input and resolves membership role from `group_mapping`.
  - Role resolution uses highest mapped tenant role across matched groups (fallback to JIT default role).
  - Response now includes `membership_role` for verification/telemetry.
  - `/v1/auth/login` now enforces `fallback_local_auth`: when tenant SSO is enabled and fallback is disabled, local password login is blocked with `LOCAL_AUTH_DISABLED`.
  - Added `POST /v1/auth/sso/oidc/start`:
    - validates tenant OIDC config
    - resolves provider metadata via OIDC discovery when needed
    - issues PKCE/state and returns provider authorization URL
  - Added `POST /v1/auth/sso/oidc/callback`:
    - exchanges authorization code for token
    - resolves identity claims from `userinfo` and/or `id_token`
    - validates id_token claims (issuer, audience, nonce, exp/iat skew) when id_token is present
    - applies JIT + group mapping role resolution
    - creates Sven access/refresh sessions
  - Added schema-aware SSO linkage persistence:
    - upsert `sso_identities`
    - upsert `sso_session_links`
    - graceful compatibility fallback when tables are unavailable
  - Added SAML endpoint pair:
    - `POST /v1/auth/sso/saml/start`: builds AuthnRequest and returns IdP redirect URL (`SAMLRequest` + `RelayState`).
    - `POST /v1/auth/sso/saml/callback`: decodes/parses SAMLResponse attributes (NameID/email/groups), applies role mapping/JIT, and issues Sven sessions.
    - Added SAML assertion guardrails:
      - optional strict signature requirement (`SVEN_SSO_STRICT_ASSERTION_VALIDATION=true`)
      - configured IdP certificate consistency check against assertion certificate (`X509Certificate`)
- `services/gateway-api/src/__tests__/tenant-sso.e2e.ts`
  - Extended to assert mapped role assignment (`ops` -> `operator`) in mock SSO path.
  - Extended with SAML start/callback path assertions (redirect generation + mapped role assertion).
  - Revalidated after OIDC/SAML endpoint additions (`pass`).

## 2026-02-23 Incremental Update (Session Link Lifecycle)

- `services/gateway-api/src/routes/auth.ts`
  - Added SSO session-link lifecycle helpers:
    - `touchSsoSessionLinks(...)`
    - `revokeSsoSessionLinksBySessionIds(...)`
    - `revokeSsoSessionLinksByUserId(...)`
    - `rotateSsoSessionLinksOnRefresh(...)`
  - Wired lifecycle behavior into auth endpoints:
    - `POST /v1/auth/logout`: revokes `sso_session_links` for cookie/bearer/refresh session ids.
    - `POST /v1/auth/logout-all`: revokes all user-linked SSO session links.
    - `POST /v1/auth/refresh`: revokes prior link + rebinds provider/subject linkage onto newly issued access and refresh sessions.
    - `GET /v1/auth/me`: updates `sso_session_links.last_seen_at` for active linked sessions.
  - Wired user credential/account actions:
    - `PATCH /v1/users/me/password`: revokes only the rotated-out session links (kept current session untouched).
    - `DELETE /v1/users/me`: revokes all user-linked SSO session links with session revocation.

- Validation:
  - `pnpm --dir services/gateway-api run build` succeeded.
  - `pnpm --dir services/gateway-api run test -- --runInBand src/__tests__/tenant-sso.e2e.ts` succeeded.
  - `tenant-sso.e2e.ts` now asserts SSO-issued token lifecycle end-to-end:
    - refresh rotates token and invalidates prior access token
    - logout revokes rotated access token
    - refresh by refresh token works
    - logout-all revokes the latest active token

## 2026-02-23 Incremental Update (OIDC Callback Negative Security Paths)

- `services/gateway-api/src/__tests__/tenant-sso.e2e.ts`
  - Added OIDC callback negative-path security coverage using an in-test mock OIDC token endpoint.
  - Asserts strict rejection behavior and error codes for:
    - invalid/expired state (`INVALID_STATE`)
    - nonce mismatch (`OIDC_NONCE_MISMATCH`)
    - nonce missing (`OIDC_NONCE_MISSING`)
    - issuer mismatch (`OIDC_ISSUER_MISMATCH`)
    - audience mismatch (`OIDC_AUDIENCE_MISMATCH`)
  - Keeps callback security behavior regression-safe without direct external provider dependency.

- Validation:
  - `pnpm --dir services/gateway-api run test -- --runInBand src/__tests__/tenant-sso.e2e.ts` succeeded.
  - `pnpm --dir services/gateway-api run build` succeeded.

## 2026-02-23 Incremental Update (OIDC Claim Time/Subject Hardening Coverage)

- `services/gateway-api/src/__tests__/tenant-sso.e2e.ts`
  - Extended OIDC callback negative-path coverage with a mock OIDC `/token` + `/userinfo` server.
  - Added explicit rejection assertions and error-code checks for:
    - expired token (`OIDC_TOKEN_EXPIRED`)
    - issued-at in future (`OIDC_TOKEN_IAT_INVALID`)
    - userinfo subject vs `id_token` subject mismatch (`OIDC_SUBJECT_MISMATCH`)

- Validation:
  - `pnpm --dir services/gateway-api run test -- --runInBand src/__tests__/tenant-sso.e2e.ts` succeeded.
  - `pnpm --dir services/gateway-api run build` succeeded.

## 2026-02-23 Incremental Update (OIDC Anti-Replay + Exchange Failure Handling)

- `services/gateway-api/src/__tests__/tenant-sso.e2e.ts`
  - Added explicit OIDC callback anti-replay state coverage:
    - first callback with valid `state` succeeds
    - second callback reusing same `state` is rejected as `INVALID_STATE`
  - Added OIDC token-exchange upstream failure coverage:
    - mock `/token` non-2xx error body propagates through callback as `OIDC_TOKEN_EXCHANGE_FAILED`
    - provider error text remains visible in returned message for diagnostics.
  - Mock OIDC test server now supports structured token endpoint error replies (`status/content-type/body`) for realistic provider failure simulation.

- Validation:
  - `pnpm --dir services/gateway-api run test -- --runInBand src/__tests__/tenant-sso.e2e.ts` succeeded (4 tests passing).
  - `pnpm --dir services/gateway-api run build` succeeded.

## 2026-02-23 Incremental Update (Keycloak Live-Provider Interop Harness)

- Added local Keycloak IdP harness for real OIDC authorization-code interop:
  - Compose service: `docker-compose.sso-idp.yml`
  - Test realm import: `services/sso/keycloak/realm-sven-test.json`
  - End-to-end smoke runner: `scripts/sso-keycloak-interop-smoke.cjs`
  - Operator runbook: `docs/integrations/keycloak-oidc-interop-smoke.md`

- Smoke behavior:
  - Uses admin bearer source in this order:
    - direct `TEST_BEARER_TOKEN`, or
    - bearer minted from `TEST_SESSION_COOKIE` via device flow.
    - or direct `/v1/auth/login` using `TEST_ADMIN_USERNAME` + `TEST_ADMIN_PASSWORD`.
  - Creates account + applies tenant OIDC config to Keycloak realm/client.
  - Runs `oidc/start`, automates Keycloak login form submit, then executes `oidc/callback`.
  - Verifies Keycloak role-to-groups mapping (`ops`) is applied to Sven tenant role mapping (`membership_role=operator`).
  - Verifies issued Sven token via `/v1/auth/me`.

- NPM commands added:
  - `docker:up:sso:keycloak`
  - `docker:down:sso:keycloak`
  - `release:sso:keycloak:interop:smoke`

## 2026-02-23 Incremental Update (Automated Live Interop Evidence Capture)

- Added evidence automation script:
  - `scripts/sso-keycloak-interop-evidence.cjs`
- Added evidence quality/freshness check:
  - `scripts/sso-keycloak-evidence-check.cjs`
- Added live interop preflight check:
  - `scripts/sso-keycloak-interop-preflight.cjs`
- Added one-shot strict gate orchestrator:
  - `scripts/sso-keycloak-interop-gate.cjs`
- Added CI workflow for reproducible gate execution:
  - `.github/workflows/d9-keycloak-interop-gate.yml`
- Integrated D9 Keycloak gate into release gate plumbing:
  - `scripts/ci-required-checks-gate.cjs` now requires `d9-keycloak-interop-gate`.
  - `.github/workflows/release-gates-sync.yml` now tracks `d9_keycloak_interop_ci`.
  - `scripts/set-release-gate.cjs` supports `d9_keycloak_interop_ci` manual override.
  - `scripts/release-status.js` now surfaces D9 Keycloak interop signals in `docs/release/status/latest.json|md`:
    - `ci_gate`
    - `local_gate_status`
    - `evidence_check_status`
    - `preflight_status`
  - `scripts/final-signoff-check.cjs` now enforces `d9_keycloak_interop_ci=true` as part of final release signoff gate.
- Added npm shortcuts:
  - `release:sso:keycloak:interop:preflight`
  - `release:sso:keycloak:interop:preflight:with-idp`
  - `release:sso:keycloak:interop:preflight:strict`
  - `release:sso:keycloak:interop:gate`
  - `release:sso:keycloak:interop:gate:with-idp-preflight`
  - `release:sso:keycloak:interop:evidence`
  - `release:sso:keycloak:interop:evidence:auto-idp`
  - `release:sso:keycloak:interop:evidence:check`
  - `release:sso:keycloak:interop:evidence:check:strict`
- Output artifacts:
  - `docs/release/evidence/d9-keycloak-interop-live-<UTCSTAMP>.json`
  - `docs/release/evidence/d9-keycloak-interop-live-<UTCSTAMP>.md`
  - `docs/release/status/d9-keycloak-interop-live-latest.json`
  - `docs/release/status/d9-keycloak-interop-live-latest.md`
- Supports optional one-shot auto lifecycle:
  - start Keycloak (`docker compose -f docker-compose.sso-idp.yml up -d`)
  - run interop smoke
  - stop Keycloak (`docker compose -f docker-compose.sso-idp.yml down -v`)
- Evidence check outputs:
  - `docs/release/status/d9-keycloak-interop-preflight-latest.json`
  - `docs/release/status/d9-keycloak-interop-preflight-latest.md`
  - `docs/release/status/d9-keycloak-interop-evidence-check-latest.json`
  - `docs/release/status/d9-keycloak-interop-evidence-check-latest.md`
  - `docs/release/status/d9-keycloak-interop-gate-latest.json`
  - `docs/release/status/d9-keycloak-interop-gate-latest.md`

## Remaining Work

- Live-provider validation against external OIDC IdPs (Keycloak/Auth0/Google Workspace), including end-to-end callback/security behavior.
- Full cryptographic XML signature verification and metadata-driven SAML trust chain validation with real IdPs.
- Group claim extraction and robust external-group -> tenant-role mapping during real SSO login.

## 2026-02-23 Incremental Update (Live Gate Reliability + Local PASS)

- Gate orchestration hardening:
  - `scripts/sso-keycloak-interop-gate.cjs`
  - Added readiness wait on Keycloak well-known endpoint before strict preflight in `--with-idp-preflight` mode.
  - Added gate-managed IdP lifecycle in this mode (`compose_up`/`compose_down`) to reduce race/flakiness.

- Evidence runner correctness fix:
  - `scripts/sso-keycloak-interop-evidence.cjs`
  - Fixed success evaluation bug where smoke `exit status 0` could be interpreted as failure.
  - Added Keycloak readiness wait when auto-starting IdP.

- Smoke resilience improvements:
  - `scripts/sso-keycloak-interop-smoke.cjs`
  - Added richer failure diagnostics including response body preview for failing API calls.
  - Added CI/local fallback bootstrap for first-account flows:
    - when `/v1/admin/accounts` returns `ORG_REQUIRED`, smoke can bootstrap a test account via `DATABASE_URL` and continue interop validation.

- Preflight strictness hardening:
  - `scripts/sso-keycloak-interop-preflight.cjs`
  - Gateway readiness now validates `API_URL/healthz` and requires strict `2xx` status.

- Validation result (local reproducible run):
  - Command: `npm run release:sso:keycloak:interop:gate:with-idp-preflight`
  - Outcome: `PASS`
  - Artifacts:
    - `docs/release/status/d9-keycloak-interop-gate-latest.md` (`Status: PASS`)
    - `docs/release/status/d9-keycloak-interop-preflight-latest.md` (`Status: PASS`)
    - `docs/release/status/d9-keycloak-interop-live-latest.md` (`Result: PASS`)
    - `docs/release/status/d9-keycloak-interop-evidence-check-latest.md` (`Status: PASS`)

- Regression coverage added:
  - `services/gateway-api/src/__tests__/tenant-rbac.e2e.ts`
  - New test: `allows account bootstrap when authenticated user has no active account set`
  - Locks the previously observed `ORG_REQUIRED` regression path for first-account bootstrap flows.

- Local reproducibility consolidation:
  - Added `scripts/sso-keycloak-local-selfcheck.cjs`
  - Added npm command: `release:sso:keycloak:interop:selfcheck:local`
  - Produces consolidated artifact:
    - `docs/release/status/d9-keycloak-local-selfcheck-latest.{json,md}`
  - Validated locally with `status: pass`.
