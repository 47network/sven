# Evidence: Staging Mirrors Production (Reduced Scale) (C6.1)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.1`

## Scope

- Item: `Staging environment mirrors production (same services, reduced scale)`

## Implementation

- Added staging compose override:
  - `docker-compose.staging.yml`
  - Keeps production service topology from base compose, with reduced-scale tuning overrides for staging:
    - smaller OpenSearch JVM heap
    - shorter Prometheus retention
    - staging deployment mode env for core runtime services

## Validation

- Added parity validation script:
  - `scripts/staging-mirror-check.cjs`
  - npm command:
    - `npm run release:staging:parity:check`
- Latest status artifacts:
  - `docs/release/status/staging-parity-latest.json`
  - `docs/release/status/staging-parity-latest.md`
- Current result (2026-02-21):
  - `Status: pass`
  - `Mode: docker_compose`
  - `production_services: 23`
  - `staging_services: 23`
  - `missing_in_staging: 0`
  - `extra_in_staging: 0`

## Result

- Staging composes the same service set as production and applies reduced-scale runtime tuning.
