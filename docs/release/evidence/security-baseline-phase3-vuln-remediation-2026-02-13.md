# Security Baseline Phase 3 Evidence: Dependency Vulnerability Remediation

Date: 2026-02-13  
Scope: Eliminate high/critical vulnerabilities in release scope (`gateway-api`, `companion-desktop-tauri`).

## Changes

- Desktop Tauri release scope isolation:
  - Removed monorepo package coupling from desktop app dependencies.
  - File: `apps/companion-desktop-tauri/package.json`

- Gateway dependency hardening:
  - Upgraded `fastify` to `^5.7.4`
  - Upgraded `bcrypt` to `^6.0.0`
  - Upgraded Fastify plugins for compatibility:
    - `@fastify/cookie` `^11.0.2`
    - `@fastify/cors` `^11.2.0`
    - `@fastify/helmet` `^13.0.2`
  - Files:
    - `services/gateway-api/package.json`
    - `services/gateway-api/src/index.ts`
    - `services/gateway-api/src/routes/auth.ts`
    - `services/gateway-api/src/types/fastify.d.ts`

## Validation

- `npm --prefix services/gateway-api run build` (pass)
- `npm run security:deps:check` (pass)
- Status artifact:
  - `docs/release/status/dependency-vuln-latest.json`
  - `docs/release/status/dependency-vuln-latest.md`

Result summary:
- High: `0`
- Critical: `0`
