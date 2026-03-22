# Security Auth Surface Check

Generated: 2026-02-22T14:32:03.622Z
Status: pass

## Totals
- v1_routes: 122
- protected: 108
- public_allowlisted: 14
- unknown: 0

## Unknown
- [x] none

## Public Allowlist
- POST /v1/auth/bootstrap (services/gateway-api/src/routes/auth.ts)
- POST /v1/auth/login (services/gateway-api/src/routes/auth.ts)
- POST /v1/auth/totp/verify (services/gateway-api/src/routes/auth.ts)
- POST /v1/auth/refresh (services/gateway-api/src/routes/auth.ts)
- GET /v1/auth/token-exchange (services/gateway-api/src/routes/auth.ts)
- POST /v1/auth/device/start (services/gateway-api/src/routes/auth.ts)
- POST /v1/auth/device/token (services/gateway-api/src/routes/auth.ts)
- GET /v1/debug/device/:device_code (services/gateway-api/src/routes/auth.ts)
- GET /v1/shared/:token (services/gateway-api/src/routes/canvas.ts)
- GET /v1/config/deployment (services/gateway-api/src/routes/deployment.ts)
- POST /v1/config/deployment/setup (services/gateway-api/src/routes/deployment.ts)
- POST /v1/devices/pair/start (services/gateway-api/src/routes/devices.ts)
- GET /v1/contracts/version (services/gateway-api/src/routes/health.ts)
- POST /v1/webhooks/:path (services/gateway-api/src/routes/webhooks.ts)
