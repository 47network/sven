# Evidence: Docker Compose Profiles (C6.3)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.3`

## Scope

- Item: `Docker Compose profiles: dev, staging, production`

## Implementation

- Added dedicated profiles overlay:
  - `docker-compose.profiles.yml`
  - Declares `dev`, `staging`, `production` profiles for default core services.
- Added profile-based startup commands:
  - `package.json`:
    - `docker:up:dev`
    - `docker:up:staging`
    - `docker:up:production`
- Added strict validation gate:
  - `scripts/docker-compose-profiles-check.cjs`
  - npm command: `npm run release:compose:profiles:check`
- Added CI gate:
  - `.github/workflows/deployment-pipeline.yml` (`Docker compose profiles gate`)

## Validation

- Command run:
  - `node scripts/docker-compose-profiles-check.cjs --strict`
- Status artifacts:
  - `docs/release/status/docker-compose-profiles-latest.json`
  - `docs/release/status/docker-compose-profiles-latest.md`
- Current result (2026-02-21):
  - `Status: pass`
  - `base: 23`
  - `dev: 23`
  - `staging: 23`
  - `production: 23`

## Result

- Compose now supports explicit environment profiles (`dev`, `staging`, `production`) with parity-checked service resolution.
