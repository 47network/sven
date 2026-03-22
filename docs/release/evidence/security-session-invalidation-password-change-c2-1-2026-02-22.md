# C2.1 Session Invalidation on Password Change (2026-02-22)

- Checklist row: `C2.1 - Session invalidation on password change`

## Implemented

Updated admin user update routes to revoke existing sessions when password is changed:

- `services/gateway-api/src/routes/admin/users.ts`
  - `PATCH /v1/admin/users/:id`
  - `PUT /v1/admin/users/:id`

Behavior:

- If request includes `password`, server updates `password_hash`.
- After successful update, all sessions for that user with status `active` or `pending_totp` are set to `revoked`.

## Local validation

Command:

```powershell
pnpm --dir services/gateway-api run build
```

Observed:

- TypeScript build passed after change.
