# Canary Rollout Strategy (2026)

## Objective
Deploy release candidates incrementally while controlling blast radius and preserving rollback speed.

## Preconditions
- `release_ops_drill_ci=true`
- `final_dod_ci=true`
- `parity_e2e_ci=true`
- Release supply-chain checks pass:
  - `release-versioning-latest.json`
  - `release-reproducibility-latest.json`
  - `release-artifacts-latest.json`
  - `release-rollout-latest.json`

## Canary Phases
1. Phase 0: Internal-only validation
   - Traffic scope: internal operators and test accounts.
   - Duration: at least 30 minutes.
2. Phase 1: 5% traffic canary
   - Observe error budget and latency for at least 60 minutes.
3. Phase 2: 25% traffic canary
   - Continue for at least 2 hours with no Sev1/Sev2 and no SLO breach.
4. Phase 3: 100% rollout
   - Complete rollout only after all canary gates remain stable.

## Validation Commands
- `npm run release:verify:post`
- `npm run release:admin:dashboard:slo:auth`
- `npm run release:privacy:compliance:auth`
- `npm run release:performance:capacity:auth`
- `npm run release:observability:operability:auth`

## Abort Criteria
- Any Sev1/Sev2 incident.
- Error rate breach beyond configured alert threshold.
- Sustained p95/p99 latency regression over SLO target for two consecutive windows.
- Critical user journey failure (auth, chat, approvals, admin metrics).

## Rollback Link
Use `docs/ops/release-rollback-runbook-2026.md` for rollback trigger handling and execution sequence.

## Evidence Requirements
- Save canary window metrics snapshots in `docs/release/evidence/`.
- Record explicit phase transition timestamps and operator approval.
