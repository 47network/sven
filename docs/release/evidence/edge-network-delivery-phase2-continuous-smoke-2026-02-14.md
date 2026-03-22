# Edge and Network Delivery Phase 2 Evidence: Continuous Smoke (2026-02-14)

## Scope
- Added continuous ingress smoke validation over a timed multi-cycle window.
- Added scheduled CI workflow to run continuous ingress smoke every 15 minutes.

## Implemented Controls
- `scripts/edge-network-continuous-check.cjs`
- `.github/workflows/edge-network-continuous-smoke.yml`
- `docs/release/status/edge-network-continuous-latest.json`

## Local Validation
- Command:
  - `EDGE_SMOKE_CYCLES=3 EDGE_SMOKE_INTERVAL_SECONDS=3 npm run release:edge:network:continuous:check`
- Result:
  - `status=pass`
  - All 3 cycles passed redirects, installer endpoints, and app readiness endpoint.
