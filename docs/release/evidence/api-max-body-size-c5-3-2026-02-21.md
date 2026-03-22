# API Stability Evidence: C5.3 Max Request Body Size (2026-02-21)

## Scope

- Checklist section: `C5.3 Input Validation`
- Item: `Maximum request body size enforced (10MB default)`

## Implementation

- `services/gateway-api/src/index.ts`
  - Fastify `bodyLimit` is now explicitly set.
  - Default is `10 * 1024 * 1024` bytes (10MB).
  - Override supported via env: `API_MAX_BODY_BYTES`.

## Verification

Oversized request test (>10MB payload):

```powershell
curl.exe -s -o NUL -w "%{http_code}" `
  -X POST http://localhost:3000/v1/auth/login `
  -H "Content-Type: application/json" `
  -H "Expect:" `
  --data-binary "@docs/performance/oversize-body-11mb.bin"
```

Result:

- HTTP status: `413`

## Result

- Maximum request body size enforcement is active with 10MB default.
