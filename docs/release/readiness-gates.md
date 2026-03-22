# Release Readiness Gates

This document defines the production gate required for parity work before merge/release.

## Engineering Gate

Required commands:

```bash
pnpm -r typecheck
pnpm -r build
npm run lint
npm run check:no-todo
```

Contract updates:
- Shared API contracts live in `packages/shared/src/types/api.ts`.
- New endpoint/shape changes must be reflected there and consumed by UI/CLI clients.

Migration safety:
- Forward-safe migrations must be additive-first (new tables/columns/indexes before cutover).
- Rollback plan is documented in `docs/db/migration-rollback-plan.md`.

## Quality Gate

Minimum test coverage for each parity feature:
- Unit tests for new pure logic.
- Integration tests for API/tool boundaries.
- E2E path for operator/user visible behavior.
- Replay harness scenario for regression checks.

Evidence template:
- Fill `docs/release/pr-evidence-template.md` in PR notes.

## Security Gate

Required artifacts:
- Threat model note in `docs/security/threat-model-parity-surfaces.md`.
- Policy coverage notes for allow/deny/approval branches.
- Audit log coverage verification for write/action endpoints.
- Secret handling through refs only (`sops://`, `vault://`, `file://`, `env://`).
- Egress controls verified for networked features.

## Operations Gate

Required checks:
- Health endpoints updated for new services.
- Prometheus alerts configured in `config/prometheus-alerts.yml`.
- Dashboards updated in `config/grafana/provisioning/dashboards/`.
- Incident runbook updated: `docs/runbooks/parity-feature-incident.md`.
- Backpressure/failure behavior explicitly defined.

## Product Gate

Required outcomes:
- Operator-facing controls available in Admin UI.
- UX path validated in supported channels/clients.
- Setup/config docs updated.
- Feature flag/staged rollout strategy specified.
- Rollback switch documented and tested.
