# API Stability Evidence: C5.2 Per-IP Auth Rate Limiting (2026-02-21)

## Scope

- Checklist section: `C5.2 Rate Limiting`
- Item: `Per-IP rate limits on authentication endpoints`

## Implementation Reference

- `services/gateway-api/src/routes/auth.ts`
  - Failed login attempts tracked by client IP.
  - Lockout threshold defaults to 5 failed attempts.
  - Lockout duration defaults to 15 minutes.

## Runtime Evidence

Gateway log entry confirms IP-based lockout trigger:

```text
{"level":"warn","service":"gateway-auth","msg":"Auth lockout triggered","ip":"172.20.0.1","attempts":5,"lockout_ms":900000}
```

See:

- `docs/release/evidence/security-auth-lockout-c2-1-2026-02-21.md`

## Result

- Authentication endpoint rate limiting is enforced per source IP.
