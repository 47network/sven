# Evidence: Environment-Specific Configs (C6.2)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.2`

## Scope

- Item: `Environment-specific configs: dev, staging, production`

## Implementation

- Added explicit compose overrides per environment:
  - `docker-compose.dev.yml`
  - `docker-compose.staging.yml`
  - `docker-compose.production.yml`
- Added environment templates:
  - `config/env/.env.development.example`
  - `config/env/.env.staging.example`
  - `config/env/.env.production.example`
- Added automated verification:
  - `scripts/environment-config-check.cjs`
  - npm command: `npm run release:config:environments:check`
- Added CI gate integration:
  - `.github/workflows/env-secrets-governance.yml`

## Validation

- Command run:
  - `node scripts/environment-config-check.cjs --strict`
- Status artifacts:
  - `docs/release/status/environment-config-latest.json`
  - `docs/release/status/environment-config-latest.md`
- Result (2026-02-21): `pass`
  - all required environment-specific files present
  - deployment mode declarations verified for dev/staging/production compose files
  - environment templates verified for dev/staging/production

## Result

- Sven now has explicit, validated environment-specific config artifacts for development, staging, and production.
