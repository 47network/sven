# Release Rollback Runbook (2026)

## Scope
- Mobile companion app backend/API rollout.
- Web/admin and canvas rollout.
- Desktop gateway/API dependent rollout.
- CLI endpoint/config rollout.

## Rollback Triggers
- Sev1/Sev2 production incident tied to release candidate.
- Sustained p95/p99 latency budget breach beyond alert threshold.
- Elevated authentication failure, approval failures, or chat send failure.
- Data integrity concern (unexpected migration side effects, queue corruption, or duplicate writes).

## Pre-Rollback Safety Checks
- Freeze further rollout and canary expansion.
- Capture current release identifiers (commit SHA, image tags, workflow run IDs).
- Capture incident timestamp and affected components.
- Confirm no destructive migration rollback is required before service rollback.

## Rollback Procedure
One-command operator wrapper (recommended):
- `SVEN_ROLLBACK_PREVIOUS_CMD="<deploy command that restores prior stable release>" npm run release:rollback:previous`

1. Disable canary expansion and switch traffic weight to previous stable release.
2. Revert service images/config to previous release tag in deployment manifests.
3. Keep additive schema changes in place unless explicit DB rollback is approved.
4. Run post-rollback health validation:
   - `npm run release:verify:post`
   - `npm run release:admin:dashboard:slo:auth`
5. Validate operator critical flows:
   - Auth login
   - Chat timeline load/send
   - Approvals list/approve/reject
   - Admin metrics and queue status
6. Record rollback execution evidence under `docs/release/evidence/`.

## Communication
- Declare incident + rollback start in on-call channel.
- Publish rollback status every 15 minutes until stable.
- Publish closure summary with root cause, blast radius, and next actions.

## Exit Criteria
- Health checks green for all core services.
- Error rate returned to pre-incident baseline.
- Queue lag within approved limits.
- Approval workflows and chat flows operational.
