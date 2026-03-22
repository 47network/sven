# Evidence: Read-only Root Filesystem Where Possible (C6.3)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.3`

## Scope

- Item: `Read-only root filesystem where possible`

## Implementation

- Added production hardening overrides with read-only rootfs + tmpfs `/tmp` for stateless services:
  - `docker-compose.production.yml`
  - Services covered:
    - `gateway-api`
    - `agent-runtime`
    - `skill-runner`
    - `registry-worker`
    - `notification-service`
    - `rag-indexer`
    - `rag-notes-ingestor`
    - `rag-nas-ingestor`
    - `rag-git-ingestor`
- Added automated verification gate:
  - `scripts/container-readonly-check.cjs`
  - npm command: `npm run release:container:readonly:check`
- Added CI gate:
  - `.github/workflows/deployment-pipeline.yml` (`Read-only rootfs gate`)

## Validation

- Command run:
  - `node scripts/container-readonly-check.cjs --strict`
- Status artifacts:
  - `docs/release/status/container-readonly-latest.json`
  - `docs/release/status/container-readonly-latest.md`
- Current result (2026-02-21):
  - `Status: pass`
  - `target_service_count: 9`
  - `violations: 0`

## Result

- Production profile now enforces read-only rootfs on applicable stateless core services, with dedicated writable tmpfs mounts.
