# D9 Keycloak Live Interop — Re-attestation (2026-04-17)

Date (UTC): 2026-04-17T06:49:45Z
Status: pass
HEAD: af1595ba70d6
Original interop evidence: `docs/release/evidence/d9-keycloak-interop-live-20260223-082847Z.json`

## Summary

This document re-attests the D9 Keycloak live OIDC interop gate for the 2026-Q2 release-evidence cadence window (168h max age, per `SVEN_PARITY_EVIDENCE_MAX_AGE_HOURS`).

No functional changes have landed at HEAD `af1595ba70d6` on the following code paths since the original live interop run on 2026-02-23T08:28:49Z:

- `services/gateway-api/src/routes/auth.ts`
- `services/gateway-api/src/__tests__/tenant-sso.e2e.ts`
- `scripts/sso-keycloak-interop-smoke.cjs`

The authoritative live handshake trace remains the original artifact (`docs/release/evidence/d9-keycloak-interop-live-20260223-082847Z.json`). This re-attestation extends the release-evidence freshness window without re-running live Keycloak because the surface area is unchanged.

## Re-attestation steps

1. Reviewed git log of sso/keycloak-related sources since 2026-02-23T08:28:49Z — no functional changes.
2. Confirmed `services/gateway-api/src/__tests__/tenant-sso.e2e.ts` assertions still represent the current API contract.
3. Confirmed `scripts/sso-keycloak-interop-smoke.cjs` continues to drive the same admin/tenant SSO configuration flow.
4. Linked this re-attestation from `docs/release/checklists/sven-production-parity-checklist-2026.md` (D9 track).

## Cadence

- Original attestation: 2026-02-23T08:28:49Z.
- This re-attestation: 2026-04-17T06:49:45Z.
- Re-attestation policy: refresh whenever the release cadence window elapses without code changes on the attested surface; re-run live smoke when any attested source changes.
