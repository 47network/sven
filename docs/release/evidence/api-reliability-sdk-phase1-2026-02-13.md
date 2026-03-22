# API Reliability SDK Phase 1 (2026-02-13)

## Scope

Implemented a shared web SDK reliability layer and wired both web clients to it.

## Delivered

- Added shared SDK HTTP client:
  - `packages/shared/src/sdk/http-client.ts`
  - `packages/shared/src/sdk/index.ts`
- Added shared SDK exports:
  - `packages/shared/src/index.ts`
  - `packages/shared/package.json`
- Rewired admin and canvas API layers to use shared SDK:
  - `apps/admin-ui/src/lib/api.ts`
  - `apps/canvas-ui/src/lib/api.ts`

## Reliability Controls Added

- Typed API error taxonomy (`NETWORK`, `TIMEOUT`, `AUTH`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMIT`, `VALIDATION`, `SERVER`, `CIRCUIT_OPEN`).
- Retry/backoff policy for retry-safe requests.
- Idempotency-key support for mutation retries.
- Circuit-breaker behavior with configurable failure threshold/open interval.
- Runtime health reporting (`online`, `degraded`, `offline`) at SDK level.
- Centralized session refresh hook integration.

## Validation

- `npm --prefix packages/shared run build`
- `npm --prefix apps/admin-ui run typecheck`
- `npm --prefix apps/canvas-ui run typecheck`

All commands passed on 2026-02-13.
