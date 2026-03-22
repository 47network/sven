# Rollback Rehearsal Evidence (2026-02-14)

Rehearsal Scope:
- Controlled rollback rehearsal for RC deployment path covering API health, ingress, and operator-critical dashboards.

Rollback Trigger Simulated:
- Simulated release anomaly trigger (latency/error regression threshold breach) to execute rollback runbook sequence.

Execution Steps:
1. Freeze rollout progression.
2. Apply rollback sequence from `docs/ops/release-rollback-runbook-2026.md`.
3. Validate recovered state with post-release verification and admin SLO checks.

Post-Rollback Validation:
- `docs/release/status/post-release-verification-latest.json` -> `status=pass`
- `docs/release/status/admin-dashboard-slo-latest.json` -> `status=pass`

Decision:
- Rollback rehearsal result: **pass**
- Runbook considered actionable for RC incident response.

Approver:
- name: Release Engineering
- role: Operations
