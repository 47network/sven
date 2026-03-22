# Sven Telemetry and User Controls Policy (2026)

Date: 2026-02-14
Scope: mobile, web/admin, desktop (Tauri), CLI, gateway/API services.

## Principles

- Collect minimum telemetry required for reliability, security, and incident response.
- Do not collect message/body content for telemetry unless explicit debug mode is enabled.
- Do not store raw secrets in telemetry under any circumstance.
- Prefer aggregate metrics over event payload copies.

## Telemetry Data Classes

1. Operational metrics
- API latency, status codes, queue depth, reconnect rates, crash counts.
- Retention: 30 days high-resolution, 180 days rolled-up aggregates.

2. Security telemetry
- Auth failure/success counts, suspicious access patterns, key rotation events.
- Retention: 180 days for investigation and auditability.

3. Product UX telemetry
- Feature usage counters (screen loads, action completion, error banners shown).
- Retention: 90 days, anonymized where possible.

4. Diagnostic traces (restricted)
- Enabled only by explicit operational toggle with expiry window.
- Must redact PII/secrets before export.
- Retention: 14 days max.

## Prohibited Fields

- Passwords, tokens, cookies, API keys, authorization headers.
- Raw personally identifying values where not strictly required (email, phone, SSN, payment data).
- Raw prompt contents for users outside explicit diagnostic consent mode.

## User Controls

- Session-level logout and revocation is always available.
- Data export workflow is available through privacy export request endpoints.
- Data deletion workflow is available through deletion request + approval + execution path.
- Diagnostic collection can be disabled globally from admin controls.

## Redaction and Access Controls

- Audit and telemetry pipelines must apply secret/PII redaction before persistence.
- Access to telemetry dashboards is role-gated (`admin`/`operator`) and audited.
- Exported telemetry bundles must be time-scoped and request-scoped.

## Compliance Evidence

- `docs/release/status/privacy-compliance-latest.json`
- `docs/release/status/privacy-compliance-latest.md`
- `docs/release/evidence/privacy-compliance-phase1-2026-02-14.md`
