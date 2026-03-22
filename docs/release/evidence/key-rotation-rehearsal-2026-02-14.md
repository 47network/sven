# Key Rotation Rehearsal Evidence

Date: 2026-02-14

Rotation Scope:
- Staging rehearsal for `JWT_SECRET`, `SESSION_SECRET`, and admin API credential set.
- Verification scope included auth/session continuity, post-release health checks, and admin dashboard SLO probe.

Secret Versions:
- old: `staging/2026-02-13/credset-a`
- new: `staging/2026-02-14/credset-b`

Staging Validation:
- status: pass
- checks:
  - `docs/release/status/post-release-verification-latest.json` -> `status=pass`
  - `docs/release/status/admin-dashboard-slo-latest.json` -> `status=pass`

Propagation Verification:
- status: pass
- observations:
  - API health/ready checks remained green after staged credential switch.
  - Authenticated admin SLO probe remained within configured latency and error budgets.
  - No rotation-related auth/session anomalies observed during validation window.

Rollback Ready:
- true
- rollback runbook used: `docs/ops/release-rollback-runbook-2026.md`

Approver:
- name: Release Engineering
- role: Operations
