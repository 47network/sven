# Evidence: Non-root User in Containers (C6.3)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.3`

## Scope

- Item: `Non-root user in all containers`

## Implementation

- Added missing runtime non-root users in Dockerfiles:
  - `services/agent-runtime/Dockerfile`
  - `services/gateway-api/Dockerfile`
  - `services/workflow-executor/Dockerfile`
  - `services/faster-whisper/Dockerfile`
  - `services/piper/Dockerfile`
  - `services/wake-word/Dockerfile`
  - `services/rag-git-ingestor/Dockerfile`
  - `services/rag-nas-ingestor/Dockerfile`
  - `services/rag-notes-ingestor/Dockerfile`
  - `services/registry-worker/Dockerfile`
  - `services/sven-mirror-agent/Dockerfile` (added dedicated `appuser`)
- Added automated enforcement:
  - `scripts/docker-nonroot-check.cjs`
  - npm command: `npm run release:container:nonroot:check`
- Added CI gate:
  - `.github/workflows/deployment-pipeline.yml` (`Non-root Docker runtime gate`)

## Validation

- Command run:
  - `node scripts/docker-nonroot-check.cjs --strict`
- Status artifacts:
  - `docs/release/status/docker-nonroot-latest.json`
  - `docs/release/status/docker-nonroot-latest.md`
- Current result (2026-02-21):
  - `Status: pass`
  - `dockerfile_count: 34`
  - `violations: 0`

## Result

- All tracked local service/app Docker runtime stages now declare a non-root user.
