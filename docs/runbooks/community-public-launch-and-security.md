# Community Public Launch And Security

This runbook makes Sven Community publicly reachable while preserving verified-persona trust posture.

## Scope

- Public portal route: `/community` (Canvas UI)
- Public APIs:
  - `GET /v1/public/community/status`
  - `POST /v1/public/community/access-request`
- Admin review APIs (`platform_admin` only):
  - `GET /v1/admin/community/access-requests`
  - `POST /v1/admin/community/access-requests/:requestId/resolve`

## Launch Steps

1. DNS
- Point community domain to Sven ingress host (A/AAAA record).

2. TLS
- Terminate TLS at edge ingress (recommended).
- Keep strong TLS ciphers and HSTS enabled.

3. Routing
- Ensure `/` traffic goes to Canvas UI (already default in docker ingress config).
- Ensure `/v1/*` traffic routes to gateway-api.
- Ensure `/admin47/*` remains protected and IP/role-controlled.
- Installer domain split supported:
  - `https://example.com/` can stay installer-focused.
  - `https://app.example.com/community` is routed to the Canvas public community portal.
  - `https://app.example.com/v1/public/community/*` is routed to gateway public community APIs.

4. Community env
- Set and verify:
  - `SVEN_COMMUNITY_DOCS_URL`
  - `SVEN_COMMUNITY_DISCORD_URL`
  - `SVEN_COMMUNITY_GITHUB_DISCUSSIONS_URL`
  - `SVEN_COMMUNITY_MARKETPLACE_URL`
  - `SVEN_COMMUNITY_ACCESS_MODE=verified_persona_only`
  - `SVEN_COMMUNITY_PERSONA_PROVIDER=...`
  - `SVEN_COMMUNITY_PERSONA_ALLOWLIST=...`
  - `SVEN_COMMUNITY_MODERATION_MODE=strict`
  - `SVEN_COMMUNITY_AGENT_POST_POLICY=reviewed_only`
  - `SVEN_COMMUNITY_SECURITY_BASELINE_SIGNED=true`
  - `SVEN_DOC_AGENT_API_BASE=https://app.example.com`
  - `SVEN_DOC_AGENT_COMMUNITY_URL=https://app.example.com/community`

5. Separate community DB
- Configure `COMMUNITY_DATABASE_URL`.
- Bootstrap schema using [community-accounts-separate-db.md](./community-accounts-separate-db.md).

## Security Controls Implemented

- Public status endpoint is redacted and cache-scoped.
- Public access request intake has:
  - input validation
  - per-IP rate limiting (server-side window)
  - queue-only onboarding (no auto-approval)
- Admin request queue and reputation/account views require `platform_admin`.
- Community onboarding/reputation data can stay isolated in separate DB.
- Admin account operations:
  - `GET /v1/admin/community/accounts` (search/filter/paginate account list)
  - `PATCH /v1/admin/community/accounts/:accountId` (update `reputation` and `verified`)
- Approving access requests auto-provisions/updates an account row in the community accounts table.
- `verified` is now evidence-based (SSO persona identity + allowlist policy), not auto-true.
- Resolve response includes `account_verified` and `verification_evidence` for audit/debug.

## Post-Launch Validation

1. `GET /community` loads without authentication.
2. `GET /v1/public/community/status` returns success with redacted policy internals.
3. Access request submit creates/updates pending request row.
4. Non-platform admins get `403` on `/v1/admin/community/accounts/status`.
5. Platform admin can approve/reject pending requests from admin community page.
6. `npm run release:community:doc-agents:verify` returns `pass` and generates fresh artifacts.

