# API Stability Evidence: C5.2 Rate Limit Headers + Retry-After (2026-02-21)

## Scope

- Checklist section: `C5.2 Rate Limiting`
- Items:
  - `Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset`
  - `429 response with Retry-After header`

## Implementation Reference

- `services/gateway-api/src/routes/auth.ts`
  - Added `setAuthRateLimitHeaders()` helper for login flow.
  - `POST /v1/auth/login` now emits:
    - `X-RateLimit-Limit`
    - `X-RateLimit-Remaining`
    - `X-RateLimit-Reset`
  - Lockout (`429`) responses now emit:
    - `Retry-After` (seconds until lockout expiry)
  - Invalid-credential attempts that cross lockout threshold now return `429` immediately with headers.

## Result

- Auth rate-limit responses now include standardized header semantics for client backoff and retry timing.
