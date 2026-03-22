# Evidence: Deployment Canary Strategy Documentation (C6.1)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.1`

## Scope

- Item: `Blue/green or canary deployment strategy documented`

## Evidence

- Canary rollout strategy document:
  - `docs/release/canary-rollout-strategy-2026.md`
  - Includes phased rollout model (Phase 0/1/2/3), abort criteria, validation commands, and evidence expectations.
- Rollback linkage (required for canary safety):
  - `docs/ops/release-rollback-runbook-2026.md`
  - Explicitly referenced from canary strategy doc for trigger handling and execution.
- CI governance gate validates both docs are present and checked:
  - `.github/workflows/release-supply-chain.yml`
  - Runs `scripts/release-rollout-check.cjs --strict` under step `Rollback and canary gate`.

## Result

- Canary deployment strategy is documented and integrated into release governance checks.
