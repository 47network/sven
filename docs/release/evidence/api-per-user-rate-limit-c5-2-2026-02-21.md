# API Stability Evidence: C5.2 Per-User Rate Limiting (2026-02-21)

## Scope

- Checklist section: `C5.2 Rate Limiting`
- Item: `Per-user rate limits on all endpoints (configurable)`

## Implementation Reference

- `services/gateway-api/src/routes/auth.ts`
  - Added per-user limiter in `requireRole()` middleware, which gates protected API routes.
  - Added `enforceUserRateLimit(reply, userId)` with fixed window counters.
  - On each authenticated request:
    - emits `X-RateLimit-Limit`
    - emits `X-RateLimit-Remaining`
    - emits `X-RateLimit-Reset`
  - On limit breach:
    - returns `429` with `Retry-After`
    - error code: `RATE_LIMITED`

## Configuration

- `API_USER_RATE_LIMIT_ENABLED` (default: enabled unless explicitly `false`)
- `API_USER_RATE_LIMIT_MAX` (default: `300`)
- `API_USER_RATE_LIMIT_WINDOW_SEC` (default: `60`)

## Result

- Authenticated endpoints protected by `requireRole()` now enforce configurable per-user rate limiting with standard client feedback headers.
