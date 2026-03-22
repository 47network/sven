# Key Rotation and Propagation Runbook (2026)

## Rotation Policy
- Rotate high-risk credentials (`JWT_SECRET`, `SESSION_SECRET`, API keys) on a defined schedule and on incident trigger.
- Rotate immediately after suspected secret exposure or unauthorized access.

## Rotation Procedure
1. Generate new secret material in approved secret manager.
2. Update staging environment and validate:
   - Authentication login/logout.
   - Chat send/stream.
   - Approvals workflow.
3. Roll to production with controlled canary.
4. Revoke old secret material after successful verification window.

## Propagation Verification
- Confirm running workloads received updated secret versions.
- Run post-change validation:
  - `npm run release:verify:post`
  - `npm run release:admin:dashboard:slo:auth`
- Check logs for auth/session anomalies in first 30 minutes.

## Incident Path
- If rotation fails, execute rollback process in `docs/ops/release-rollback-runbook-2026.md`.
- Open incident timeline and include exact secret version identifiers (not secret values).
