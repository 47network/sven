# PR Test Evidence Template

Copy this into PR notes and fill all sections.

## Scope
- Feature/section:
- Risk level:
- Affected services:

## Engineering Evidence
- [ ] `pnpm -r typecheck`:
- [ ] `pnpm -r build`:
- [ ] `npm run lint`:
- [ ] `npm run check:no-todo`:
- Contract files changed:
- Migration + rollback note:

## Quality Evidence
- Unit tests:
- Integration tests:
- E2E tests:
- Replay harness scenario:

## Security Evidence
- Threat model link:
- Policy allow/deny/approval paths tested:
- Audit log endpoint coverage:
- Secret ref usage verified:
- Egress restrictions validated:

## Operations Evidence
- Health endpoints:
- Metrics/alerts:
- Dashboard updates:
- Runbook updates:
- Backpressure behavior:

## Product Evidence
- Admin UI controls:
- UX validation:
- Docs updates:
- Feature flag/staged rollout:
- Rollback switch:
