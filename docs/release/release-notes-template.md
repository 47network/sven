# Release Notes Template

## Release
- Version:
- Date:
- Commit/tag:

## User-Facing Changes
- 

## Operator-Facing Changes
- 

## Migrations
- Applied migrations:
- Compatibility notes:

## Rollback Steps
1. Toggle feature flags/config switches to safe mode.
2. Roll back service images to previous tag.
3. Keep additive schema unless hard rollback is required.
4. If required, execute rollback SQL from `docs/db/migration-rollback-plan.md`.
5. Verify `/health`, queue lag, and error rates return to baseline.

## Verification
- [ ] Health checks green
- [ ] Queue lag acceptable
- [ ] Error rate within threshold
- [ ] Approval flows operational
