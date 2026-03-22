# Evidence: Container Restart Policies (C6.3)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.3`

## Scope

- Item: `Container restart policies: unless-stopped or always`

## Verification

- File inspected: `docker-compose.yml`
- Verification run (scripted scan of `services` block):
  - `services: 49`
  - `missing_restart: 0`
  - `invalid_restart: 0`

## Result

- All defined services in `docker-compose.yml` include a restart policy.
- All restart policies are compliant with checklist requirement (`unless-stopped` or `always`).
