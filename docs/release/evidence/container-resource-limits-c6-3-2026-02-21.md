# Evidence: Container Resource Limits (C6.3)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.3`

## Scope

- Item: `Resource limits defined (CPU + memory) for all containers`

## Implementation

- Added production resource limits (`deploy.resources.limits.cpus` + `memory`) for the full default production service set:
  - `docker-compose.production.yml`
- Targeted services (23):
  - `egress-proxy`, `nats`, `postgres`, `gateway-api`, `otel-collector`, `prometheus`, `grafana`, `ollama`, `rag-git-ingestor`, `rag-notes-ingestor`, `searxng`, `agent-runtime`, `notification-service`, `piper`, `opensearch`, `rag-indexer`, `rag-nas-ingestor`, `registry-worker`, `skill-runner`, `sven-internal-nginx`, `wake-word`, `faster-whisper`, `workflow-executor`
- Added automated verification:
  - `scripts/container-resource-limits-check.cjs`
  - npm command: `npm run release:container:resources:check`
- Added CI gate:
  - `.github/workflows/deployment-pipeline.yml` (`Container resource limits gate`)

## Validation

- Command run:
  - `node scripts/container-resource-limits-check.cjs --strict`
- Status artifacts:
  - `docs/release/status/container-resource-limits-latest.json`
  - `docs/release/status/container-resource-limits-latest.md`
- Current result (2026-02-21):
  - `Status: pass`
  - `target_service_count: 23`
  - `violations: 0`

## Result

- Production compose now declares CPU and memory limits for the full default deployment container set, with enforcement in CI/release gates.
