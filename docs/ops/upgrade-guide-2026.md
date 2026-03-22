# Upgrade Guide (Version-to-Version)

Date: 2026-02-21

## Scope

This guide covers standard upgrades for Sven deployments (compose-based and similar topologies).

## Pre-Upgrade

1. Confirm current version and target version.
2. Review release notes and migration notes.
3. Back up database and critical config/secrets.
4. Verify rollback images and rollback procedure are available.

## Upgrade Steps

1. Pull updated source/images for the target version.
2. Apply database migrations.
3. Restart services in dependency order:
   - data services (postgres, nats, opensearch)
   - gateway-api
   - agent-runtime and workers
   - channel adapters and web UIs
4. Run smoke checks:
   - login/auth
   - chat streaming
   - approval flow
   - one active channel adapter

## Post-Upgrade Validation

- No sustained 5xx increase.
- p95 latency within baseline bounds.
- No unexpected restarts.
- Scheduled jobs and backups still running.

## Rollback Trigger

Rollback if critical regression persists beyond defined SLO windows or security controls fail.

## References

- `docs/release/checklists/sven-production-parity-checklist-2026.md`
- `docs/release/soak-72h-runbook.md`
- `docs/ops/release-rollback-runbook-2026.md`
