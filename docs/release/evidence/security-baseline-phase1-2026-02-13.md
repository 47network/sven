# Security Baseline Phase 1 (2026-02-13)

## Scope

Implemented CI/security gate primitives for:
- plaintext secret detection in source,
- dependency vulnerability scanning with threshold enforcement.

## Delivered

- CI workflow:
  - `.github/workflows/security-baseline.yml`
- Secret scan gate:
  - `scripts/security-plaintext-secrets-check.cjs`
  - `package.json` (`security:plaintext:check`)
- Dependency vulnerability gate:
  - `scripts/dependency-vuln-check.cjs`
  - `package.json` (`security:deps:check`)
  - status outputs:
    - `docs/release/status/dependency-vuln-latest.json`
    - `docs/release/status/dependency-vuln-latest.md`

## Validation

- `npm run security:plaintext:check`
- `npm run security:deps:check`

## Current Status

- Secret scan: pass.
- Dependency vulnerability check: fail with current thresholds (`critical<=0`, `high<=10`), which correctly blocks until remediation or threshold policy update.
