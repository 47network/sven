# Evidence: CI/CD Deployment Pipeline (C6.1)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.1`

## Scope

- Item: `CI/CD pipeline: build → test → security scan → staging → production`

## Implementation

- Added workflow:
  - `.github/workflows/deployment-pipeline.yml`
- Job order and gates:
  1. `build` (`npm run typecheck`)
  2. `test` (`npm run test`) — requires `build`
  3. `security` (`npm run security:deps:check`, `npm run security:plaintext:check`) — requires `test`
  4. `staging` (environment: `staging`) — requires `security`
  5. `production` (environment: `production`) — requires `staging`

## Deployment Hooks

- Optional deploy commands supported via CI secrets:
  - `STAGING_DEPLOY_CMD`
  - `PRODUCTION_DEPLOY_CMD`
- If unset, workflow logs a skip message while preserving stage ordering and gating.

## Result

- CI/CD pipeline now codifies required stage sequence and promotion gates from build through production.
