# D9 Enterprise SSO — Phase 1 Re-attestation (2026-04-17)

Date (UTC): 2026-04-17T06:49:45Z
Status: pass
HEAD: af1595ba70d6
Original Phase 1 evidence: `docs/release/evidence/d9-enterprise-sso-phase1-2026-02-22.md`

## Summary

This document re-attests the D9 Enterprise SSO Phase 1 admin-UI + backend surface for the 2026-Q2 release-evidence cadence window (168h max age, per `SVEN_PARITY_EVIDENCE_MAX_AGE_HOURS`).

No functional changes have landed at HEAD `af1595ba70d6` on the following code paths since the original Phase 1 attestation on 2026-02-22:

- `apps/admin-ui/src/app/sso/page.tsx`
- `apps/admin-ui/src/components/layout/Sidebar.tsx`
- `apps/admin-ui/src/lib/api.ts` (`settings.getSso`, `settings.setSso`, `SsoConfig`)
- `apps/admin-ui/src/lib/hooks.ts` (`useSsoSettings`, `useSetSsoSettings`)
- `services/gateway-api/src/routes/admin/settings.ts` (SSO redaction-preserve path)

The authoritative Phase 1 scope and validation record remains the original document (`docs/release/evidence/d9-enterprise-sso-phase1-2026-02-22.md`). This re-attestation extends the release-evidence freshness window without re-running the full Phase 1 validation because the surface area is unchanged.

## Re-attestation steps

1. Reviewed git log of the admin-ui SSO and gateway-api SSO-settings routes since 2026-02-22 — no functional changes.
2. Confirmed `PUT /v1/admin/settings/sso` still preserves existing secret values when the client submits redacted placeholders (`***` for `oidc.client_secret` and `saml.cert_pem`).
3. Confirmed admin navigation still exposes `Security → SSO` at `/sso`.
4. Linked this re-attestation from `docs/release/checklists/sven-production-parity-checklist-2026.md` (D9 track).

## Cadence

- Original attestation: 2026-02-22.
- This re-attestation: 2026-04-17T06:49:45Z.
- Re-attestation policy: refresh whenever the release cadence window elapses without code changes on the attested surface; re-run the full Phase 1 validation when any attested source changes.
