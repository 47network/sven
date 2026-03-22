# Troubleshooting Tree (2026)

## Service Unreachable
1. Check ingress readiness:
   - `npm run release:edge:network:check`
2. Check gateway readiness:
   - `curl -sSf https://app.example.com/readyz`
3. Check compose services:
   - `docker compose ps`

## Auth Failures
1. Validate environment secrets:
   - `npm run release:env:secrets:check`
2. Validate auth endpoints through ingress:
   - `curl -i https://app.example.com/v1/auth/login`
3. Confirm rate-limit settings did not over-throttle auth path.

## Elevated Errors or Latency
1. Run admin SLO probe:
   - `npm run release:admin:dashboard:slo:auth`
2. Run performance gate:
   - `npm run release:performance:capacity:auth`
3. If persistent, begin rollback:
   - `docs/ops/release-rollback-runbook-2026.md`

## Release Gate Failure
1. Regenerate status:
   - `npm run release:status`
2. Check CI gates:
   - `docs/release/status/ci-gates.json`
3. Review evidence docs under:
   - `docs/release/evidence/`

