# Compliance Mapping (GDPR + SOC2)

Date: 2026-02-21

## Scope

High-level control mapping for Sven production controls to GDPR principles and SOC2-style control families.

## GDPR Mapping (High-Level)

- Lawfulness, fairness, transparency:
  - documented privacy/compliance checklist and release signoff artifacts.
- Data minimization and purpose limitation:
  - scoped data collection in service contracts and policy-gated tool access.
- Integrity and confidentiality:
  - transport security controls, auth enforcement, and security baselines.
- Storage limitation:
  - retention and backup operational controls with periodic verification.
- Data subject rights support:
  - operational procedures and platform APIs used for export/delete workflows.

## SOC2 Mapping (High-Level)

- Security:
  - threat model, security baseline, vulnerability management evidence.
- Availability:
  - runbooks, observability status checks, soak/failure mode evidence.
- Confidentiality:
  - secret handling controls and redaction expectations.
- Processing integrity:
  - checklist-driven release gates, migration validation, smoke testing.
- Privacy:
  - privacy compliance evidence and documented operational safeguards.

## Evidence Pointers

- `docs/privacy/compliance-checklist-2026.md`
- `docs/release/status/privacy-compliance-latest.md`
- `docs/release/evidence/privacy-compliance-phase1-2026-02-14.md`
- `docs/release/signoffs/compliance-signoff-2026-02-14-rc.md`
- `docs/security/threat-model.md`
- `docs/security/incident-response-playbook.md`
