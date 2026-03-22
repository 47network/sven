# Web Admin UX Phase 6: Authenticated Dashboard Probe Readiness

Date: 2026-02-13  
Scope: Remove manual-cookie dependency for dashboard SLO validation.

## Implemented

### 1. SLO checker supports credential login

File:
- `scripts/admin-dashboard-slo-check.cjs`

Additions:
- Optional env auth inputs:
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD`
  - `ADMIN_TOTP_CODE` (if MFA required)
- Automatic login flow:
  - `POST /v1/auth/login`
  - optional `POST /v1/auth/totp/verify`
  - extracts `sven_session` cookie and runs admin probes.
- Reports `auth_mode` in status output.

### 2. One-command authenticated ops wrapper

File:
- `scripts/ops/admin/run-dashboard-slo-auth.ps1`

Package script:
- `release:admin:dashboard:slo:auth` in `package.json`
- `release:admin:dashboard:slo:auth:interactive` in `package.json`

## Validation

- Live-domain unauthenticated baseline re-run:
  - `API_URL=https://app.sven.example.com node scripts/admin-dashboard-slo-check.cjs`
  - status: `warn`
  - checks: pass
  - auth_mode: `none` (no creds provided in this environment)

## Remaining to close DoD

- Run authenticated probe with admin credentials:
  - `powershell -ExecutionPolicy Bypass -File scripts/ops/admin/run-dashboard-slo-auth.ps1 -ApiUrl https://app.sven.example.com -AdminUsername <user> -AdminPassword <pass> [-AdminTotpCode <code>]`
  - or interactive: `npm run release:admin:dashboard:slo:auth:interactive`
- Expect `status=pass` and `auth_mode=admin_login` or `session_cookie_env`.

