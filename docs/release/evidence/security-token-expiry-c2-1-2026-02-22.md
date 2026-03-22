# C2.1 Token Expiry Enforcement (Access 15m / Refresh 7d)

Date: 2026-02-22  
Owner: Codex session

## Scope

Implement and enforce short-lived access sessions and long-lived refresh sessions in gateway auth flows.

## Changes

- `services/gateway-api/src/routes/auth.ts`
  - Enforced `ACCESS_TOKEN_MAX_AGE = 15 * 60`.
  - Enforced `REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60`.
  - Added dedicated refresh cookie `sven_refresh` (httpOnly, strict sameSite, secure in production).
  - Login now mints access + refresh sessions and returns distinct `access_token` / `refresh_token`.
  - TOTP verify now upgrades pending pre-session to 15m access and mints 7d refresh.
  - Refresh endpoint now rotates into new access + refresh pair and revokes the submitted session.
  - Token exchange and device token flow now mint access + refresh pair.
  - Logout / logout-all now clear refresh cookie and revoke refresh sessions as well.

- `services/gateway-api/src/db/migrations/116_sessions_refresh_status.sql`
  - Extended `sessions.status` check constraint to allow `'refresh'`.

## Validation

- `pnpm --dir services/gateway-api run build` -> pass.
- `pnpm --dir services/gateway-api test -- auth.logout.e2e.ts` -> fails in this local run due to no reachable local API target (`AggregateError` connection failure), not assertion mismatch.

## Notes

- Refresh endpoint currently accepts both `refresh` and legacy `active` session IDs during rotation for compatibility with older clients while migrating to explicit refresh-token usage.
