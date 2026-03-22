# Sven Privacy Compliance Checklist (2026)

Date: 2026-02-14

## Controls

- [x] Retention policy endpoint returns active policy by user/global fallback.
- [x] Data export request workflow exists (create + status).
- [x] Data deletion workflow exists (create + approve + execute).
- [x] PII detection endpoint exists and is testable.
- [x] Redaction endpoint exists and is testable.
- [x] Audit log output sanitizes secret/PII-like values before response.
- [x] Telemetry policy and user controls documented.

## Verification

- Runtime check command:
  - `npm run release:privacy:compliance:auth -- -ApiUrl https://app.example.com -AdminUsername <user> -AdminPassword <pass>`
- Status artifacts:
  - `docs/release/status/privacy-compliance-latest.json`
  - `docs/release/status/privacy-compliance-latest.md`

## Release Gate Condition

- Pass when all checks in `privacy-compliance-latest.json` are true.

