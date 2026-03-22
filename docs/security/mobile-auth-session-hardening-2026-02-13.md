# Mobile Auth/Session Hardening Progress

Date: 2026-02-13  
Surface: `apps/companion-mobile`
Gateway: `services/gateway-api`

## Changes Implemented

- Replaced token-only AsyncStorage persistence with SecureStore-first storage.
- Added legacy token migration path from AsyncStorage to SecureStore.
- Added secure token delete path on sign-out.
- Added explicit mobile sign-out action in UI:
  - calls `/v1/auth/logout` best-effort
  - clears local token and session state
- Extended `/v1/auth/logout` to revoke bearer-token sessions (device OAuth sessions), not only cookie sessions.
- Added `/v1/auth/refresh` session rotation endpoint (revokes old session id and issues a new token).
- Added mobile authenticated fetch wrapper with automatic token refresh/retry on `401`.
- Added `/v1/auth/logout-all` endpoint for remote session invalidation (revoke all active sessions for current user).
- Added mobile UI action for "Sign out all devices".
- Added web API client refresh/retry behavior for both admin and canvas UIs.
- Added desktop companion refresh/retry on `401` with token rotation persistence.
- Added auth logout e2e coverage for bearer-session revocation path.
- Added CI workflow for mobile auth/session smoke (`mobile-auth-session-smoke`) using gateway e2e.
- Added automated release check script for SecureStore + Android cleartext policy.
- Set `apps/companion-mobile/app.json` to `android.usesCleartextTraffic=false` for release-safe transport defaults.
- Hardened desktop local token-at-rest by encrypting persisted token via Electron `safeStorage`.

## Files

- `apps/companion-mobile/App.tsx`
- `apps/companion-mobile/package.json`
- `services/gateway-api/src/routes/auth.ts`
- `services/gateway-api/src/__tests__/auth.logout.e2e.ts`
- `apps/admin-ui/src/lib/api.ts`
- `apps/canvas-ui/src/lib/api.ts`
- `apps/companion-desktop/main.js`
- `services/gateway-api/src/__tests__/mobile-auth-session.e2e.ts`
- `.github/workflows/mobile-auth-session-smoke.yml`
- `scripts/mobile-securestore-release-check.cjs`
- `docs/release/status/mobile-securestore-release-check.json`
- `docs/release/status/mobile-securestore-release-check.md`
- `apps/companion-mobile/app.json`

## Remaining for Section C completion

- Validate SecureStore behavior on iOS and Android release builds.
- Continue desktop migration to Tauri secure storage target for final parity.
