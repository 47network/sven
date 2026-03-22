# Sven Release Notes (RC)

## Release
- Version: `0.1.1-rc`
- Date: `2026-03-16`
- Branch: `thesven`
- Commit: `cfbb5e9`
- State: `RC prepared, soak closeout pending`

## Summary
This RC consolidates parity hardening, mobile release-readiness improvements, operational governance updates, and stash/data recovery proofing into a single clean release branch.

## User-Facing Changes
- Mobile companion app stability and auth/session reliability improvements.
- Expanded device-control and ambient/mirror-related UX paths in Flutter client.
- Improved chat reliability paths (sync, SSE handling, and message repository consistency).

## Platform and Operator Changes
- Parity CI hard-gated with LangGraph Wave 8 closeout checks and updated lifecycle gating.
- Release/status governance refreshed across scripts and workflows for stricter provenance.
- Additional security/release controls (image signing/SBOM checks, rollout and artifact checks).
- Gateway and runtime hardening across auth/admin/routes, scheduling, replay, and integrations.

## Data Safety and Recovery
- Stash recovery lane completed and merged into `thesven`.
- Lossless preservation proof generated:
  - `docs/release/status/stash0-lossless-proof-latest.md`
  - `docs/release/status/stash0-lossless-proof-latest.json`
- Coverage result: `4029/4029` stash paths covered (`39` delete entries, `0` uncovered).

## Migrations
- Added: `services/gateway-api/src/db/migrations/20260305003000_calendar_oauth_states.sql`
- Migration policy remains additive-first for RC rollout safety.

## Known Pending Gate
- `soak_72h` lifecycle closeout still pending final completion/promotion evidence.

## Rollback Guidance
1. Revert deployment to previous stable tag/image set.
2. Keep additive DB schema unless emergency rollback is explicitly required.
3. Re-run post-rollback checks:
   - `/health`
   - queue/backlog indicators
   - auth/session flows
   - parity checklist verify

## Final Release Criteria
- [ ] Soak closeout evidence promoted (`soak_72h=pass`)
- [ ] Lifecycle keys promoted (`week4_rc_complete=pass`, `post_release_verified=pass`)
- [ ] Strict parity/checklist verify green
- [ ] Tag and publish final `0.1.1`
