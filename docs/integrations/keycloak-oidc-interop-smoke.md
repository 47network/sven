# Keycloak OIDC Interop Smoke (Sven)

This smoke validates Sven's real OIDC authorization-code flow against a live Keycloak IdP.

## 1) Start Keycloak test IdP

```bash
npm run docker:up:sso:keycloak
```

Keycloak test realm/client/user are imported from:

- `services/sso/keycloak/realm-sven-test.json`

Defaults:

- Realm: `sven`
- Client: `sven-gateway`
- Client secret: `sven-gateway-secret`
- Test user: `sven-sso-user` / `sven-sso-pass`

## 2) Preconditions

- Sven gateway is running and reachable (default: `http://127.0.0.1:3001`)
- One admin auth source is available:
  - `TEST_BEARER_TOKEN` (preferred), or
  - `TEST_SESSION_COOKIE` (authenticated admin browser session cookie), or
  - `TEST_ADMIN_USERNAME` + `TEST_ADMIN_PASSWORD` (direct `/v1/auth/login`)

If admin TOTP is enforced and username/password login returns `requires_totp`, use `TEST_BEARER_TOKEN` or `TEST_SESSION_COOKIE`.

Optional overrides:

- `API_URL`
- `KEYCLOAK_BASE_URL` (default `http://127.0.0.1:8081`)
- `KEYCLOAK_REALM`
- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_CLIENT_SECRET`
- `KEYCLOAK_TEST_USERNAME`
- `KEYCLOAK_TEST_PASSWORD`
- `SSO_OIDC_REDIRECT_URI`
- `TEST_ADMIN_USERNAME`
- `TEST_ADMIN_PASSWORD`

## 3) Run interop smoke

Optional fast preflight before smoke:

```bash
npm run release:sso:keycloak:interop:preflight
```

Preflight validates both auth-source presence and auth-source validity (`/v1/auth/me` probe for bearer/cookie, login probe for username/password).

Check both Sven and live Keycloak reachability:

```bash
npm run release:sso:keycloak:interop:preflight:with-idp
```

```bash
npm run release:sso:keycloak:interop:smoke
```

Or run and write timestamped release evidence artifacts:

```bash
npm run release:sso:keycloak:interop:evidence
```

Or auto-start/stop Keycloak and write evidence in one command:

```bash
npm run release:sso:keycloak:interop:evidence:auto-idp
```

`evidence:auto-idp` waits for Keycloak readiness (`/.well-known/openid-configuration`) before running smoke.

Validate latest evidence snapshot quality/freshness:

```bash
npm run release:sso:keycloak:interop:evidence:check
```

Fail hard (CI/release gate) when evidence is missing/stale/failed:

```bash
npm run release:sso:keycloak:interop:evidence:check:strict
```

One-shot gate (strict preflight -> live evidence -> strict evidence check):

```bash
npm run release:sso:keycloak:interop:gate
```

Single-command local full selfcheck (build/migrate/seed/start gateway + tenant RBAC regression + live interop gate):

```bash
npm run release:sso:keycloak:interop:selfcheck:local
```

Local readiness chain (selfcheck -> release status -> checklist sync -> strict local final signoff):

```bash
npm run release:d9:readiness:local
```

Fast path when selfcheck was already run:

```bash
node scripts/d9-local-readiness.cjs --skip-selfcheck
```

Include Keycloak reachability in preflight before running gate:

```bash
npm run release:sso:keycloak:interop:gate:with-idp-preflight
```

In `with-idp-preflight` mode, the gate auto-starts Keycloak, waits for readiness, runs strict preflight with live IdP reachability, then tears Keycloak down.

The smoke performs:

1. Admin bearer resolve (priority order):
   - `TEST_BEARER_TOKEN`
   - device flow from `TEST_SESSION_COOKIE`
   - `/v1/auth/login` from `TEST_ADMIN_USERNAME` + `TEST_ADMIN_PASSWORD`
2. Tenant account creation
3. Tenant OIDC SSO config apply
4. `/v1/auth/sso/oidc/start`
5. Keycloak login form submit (username/password)
6. `/v1/auth/sso/oidc/callback`
7. Group mapping assertion (`ops` from Keycloak role mapper -> Sven `membership_role=operator`)
8. `/v1/auth/me` validation with issued Sven access token

Bootstrap note:
- If account bootstrap endpoint returns `ORG_REQUIRED` and `DATABASE_URL` is available (CI/local), the smoke auto-bootstraps a test account directly in DB for deterministic interop execution.

## 4) Tear down Keycloak

```bash
npm run docker:down:sso:keycloak
```

## Evidence Output

Evidence files are written to `docs/release/evidence/`:

- `d9-keycloak-interop-live-<UTCSTAMP>.json`
- `d9-keycloak-interop-live-<UTCSTAMP>.md`

Latest snapshots are also published to `docs/release/status/`:

- `d9-keycloak-interop-live-latest.json`
- `d9-keycloak-interop-live-latest.md`
- `d9-keycloak-interop-preflight-latest.json`
- `d9-keycloak-interop-preflight-latest.md`
- `d9-keycloak-interop-evidence-check-latest.json`
- `d9-keycloak-interop-evidence-check-latest.md`
- `d9-keycloak-interop-gate-latest.json`
- `d9-keycloak-interop-gate-latest.md`
