# Security Evidence: C2.1 CORS Allowlist Lockdown (2026-02-21)

## Scope

- Checklist section: `C2.1 Authentication & Authorization`
- Item: `CORS configuration locked to allowed origins`

## Configuration Reference

- `services/gateway-api/src/index.ts`
  - CORS handled via `@fastify/cors` with `origin: parseCorsOrigin()`.
  - `CORS_ORIGIN` in env currently set to `http://localhost:3100`.

## Verification

Preflight requests against `OPTIONS /v1/auth/login`:

### Disallowed origin

```bash
curl -i -X OPTIONS http://localhost:3000/v1/auth/login \
  -H "Origin: https://evil.example" \
  -H "Access-Control-Request-Method: POST"
```

Result:

- `access-control-allow-origin` header not present.

### Allowed origin

```bash
curl -i -X OPTIONS http://localhost:3000/v1/auth/login \
  -H "Origin: http://localhost:3100" \
  -H "Access-Control-Request-Method: POST"
```

Result:

- `access-control-allow-origin: http://localhost:3100`

## Result

- CORS policy is restricted to configured allowed origin(s); unknown origins are not allowed.
