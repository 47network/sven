# Evidence: Multi-stage Docker Builds (C6.3)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.3`

## Scope

- Item: `Multi-stage Docker builds (minimal production images)`

## Implementation

- Converted remaining single-stage Dockerfiles to explicit multi-stage:
  - `services/workflow-executor/Dockerfile` (`build` -> `runtime`)
  - `services/sven-mirror-agent/Dockerfile` (`build` -> `runtime`)
- Added automated compliance check:
  - `scripts/docker-multistage-check.cjs`
  - npm command: `npm run release:container:multistage:check`
- Added CI gate:
  - `.github/workflows/deployment-pipeline.yml` (`Multi-stage Dockerfile gate`)

## Validation

- Command run:
  - `node scripts/docker-multistage-check.cjs --strict`
- Status artifacts:
  - `docs/release/status/docker-multistage-latest.json`
  - `docs/release/status/docker-multistage-latest.md`
- Current result (2026-02-21):
  - `Status: pass`
  - `dockerfile_count: 34`
  - `single_stage_files: 0`

## Result

- All discovered service/app Dockerfiles now use multi-stage builds, with automated enforcement in release checks and CI.
