# C2.1 Authentication Coverage Audit (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

Audit `/v1/*` route authentication posture and close unauthenticated gaps discovered during review.

## Gaps Fixed

- `services/gateway-api/src/routes/outbox.ts`
  - Added adapter-token guard (`X-SVEN-ADAPTER-TOKEN`) to:
    - `GET /v1/outbox/next`
    - `POST /v1/outbox/:id/sent`
    - `POST /v1/outbox/:id/error`
  - Previously these routes were callable without auth.

- `services/gateway-api/src/routes/devices.ts`
  - Added session auth (`requireRole(pool, 'admin', 'user')`) to:
    - `GET /v1/devices/events/stream`
  - Route comment already stated this required session auth; implementation now matches.

## Validation

- `pnpm --dir services/gateway-api run build` -> pass.
- `npm run security:auth-surface:check` -> pass (`docs/release/status/security-auth-surface-latest.md`).

## 2026-02-22 Tightening Pass

- Added local automated surface checker:
  - `scripts/security-auth-surface-check.cjs`
  - npm command: `security:auth-surface:check`
- Checker scans all `services/gateway-api/src/routes/**/*.ts` for `/v1/*` routes and classifies each as:
  - protected by `preHandler`
  - protected by recognized inline/token auth
  - explicitly allowlisted public surface
  - unknown (fails strict mode)
- Local strict run now reports:
  - `v1_routes: 122`
  - `protected: 108`
  - `public_allowlisted: 14`
  - `unknown: 0`

- Hardening fix applied:
  - `services/gateway-api/src/routes/auth.ts`
    - `POST /v1/auth/logout` now requires an active authenticated session and returns `401` when missing/invalid.

## Remaining Public/Non-Session Surfaces (intentional or pending hardening)

- Health/readiness:
  - `/healthz`, `/readyz`
- Auth/bootstrap/session acquisition:
  - `/v1/auth/*` login/bootstrap/device/token-exchange paths
  - `/v1/config/deployment`, `/v1/config/deployment/setup`
- Token/signed-ingress protected (non-session auth):
  - `/v1/events/*`, `/v1/adapter/*` (adapter token)
  - `/v1/mcp` (MCP server token)
  - `/v1/webhooks/:path` (path + optional signature secret)
  - `/v1/email/push` (verification token when configured)

## Note

Checklist item language ("except /healthz") is stricter than current bootstrap/auth architecture. This audit closes concrete unauthenticated gaps and records remaining intentional public/auth-ingress routes for follow-up hardening decisions.
