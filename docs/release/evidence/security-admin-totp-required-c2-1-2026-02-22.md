# C2.1 Admin TOTP Required (2026-02-22)

- Checklist row: `C2.1 - TOTP/2FA required for admin accounts`

## Implemented

Updated auth login guard to enforce TOTP for admin users:

- `services/gateway-api/src/routes/auth.ts`
  - In `POST /v1/auth/login`, after password verification:
    - if `role === 'admin'` and `totp_secret_enc` is missing, request is denied with:
      - HTTP `403`
      - error code `ADMIN_TOTP_REQUIRED`

This prevents password-only login for admin accounts and enforces 2FA enrollment as a hard requirement.

## Local validation

Command:

```powershell
pnpm --dir services/gateway-api run build
```

Observed:

- Build passed.
