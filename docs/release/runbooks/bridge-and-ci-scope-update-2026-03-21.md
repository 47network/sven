# Runbook Scope Update — 2026-03-21

## Why this update exists
- Bridge integration and CI gate wiring were expanded in this workspace.
- Workflow coverage was restored for release-critical lanes that were missing locally.

## Scope touched
- Bridge runtime test lane and gateway bridge contract lane.
- Required release workflow inventory under `.github/workflows/`.
- Multi-VM strict-mode tenant-mapping cutover guidance.

## Operational impact
- CI surfaces will execute broader bridge and gateway contract checks.
- Runbook strict-mode key usage remains `SVEN_BRIDGE_REQUIRE_TENANT_MAPPING` with legacy alias support.
- No destructive migration or infra rollback path changes are introduced by this scope update.

## Validation points
- `bridge-runtime-tests` executes bridge runtime tests.
- `gateway-bridge-contract-tests` executes admin/bridge/rag contract tests.
- Local release diagnostic gates regenerate successfully after workflow restore.
