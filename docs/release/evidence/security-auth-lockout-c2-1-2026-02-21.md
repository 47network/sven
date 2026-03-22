# Security Evidence: C2.1 Auth Lockout Rate Limiting (2026-02-21)

## Scope

- Checklist section: `C2.1 Authentication & Authorization`
- Item: `Rate limiting on auth endpoints (5 failed attempts -> 15min lockout)`
- Route: `POST /v1/auth/login`

## Implementation Reference

- `services/gateway-api/src/routes/auth.ts`
  - `MAX_FAILED_ATTEMPTS` defaults to `5`
  - `LOCKOUT_DURATION_MS` defaults to `15 * 60 * 1000`
  - On threshold breach, server logs `Auth lockout triggered`
  - Subsequent login attempts return `429` with lockout error

## Runtime Verification

Observed in gateway logs:

```text
{"level":"warn","ts":"2026-02-21T17:56:37.128Z","service":"gateway-auth","msg":"Auth lockout triggered","ip":"172.20.0.1","attempts":5,"lockout_ms":900000}
```

Validation command used:

```powershell
docker compose logs --since 20m gateway-api | rg "Auth lockout triggered|LOCKED_OUT|Too many failed login attempts"
```

## Result

- Lockout threshold reached at 5 failed attempts.
- Lockout duration confirmed as 900000ms (15 minutes).
- C2.1 auth endpoint rate limiting requirement is satisfied.
