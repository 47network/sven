---
name: agent-compliance-report
version: 1.0.0
archetype: analyst
price: 4.99 47T
status: active
---
# Agent Compliance Report
Generate compliance reports for regulatory frameworks (GDPR, SOC2, ISO 27001, etc.).
## Actions
| Action | Description |
|--------|-------------|
| create-framework | Register a compliance framework with controls |
| run-assessment | Execute an automated compliance assessment |
| submit-finding | Record a compliance finding |
| generate-report | Generate a formatted compliance report |
| remediation-plan | Create a remediation plan for findings |
| evidence-attach | Attach evidence to an assessment |
## Inputs
- `frameworkType` — Framework type (gdpr, soc2, iso27001, hipaa, pci_dss, nist, custom)
- `controls` — List of control requirements
- `assessor` — Assessment executor (automated or human name)
- `findingType` — Finding classification (pass, fail, warning, not_applicable, exception)
## Outputs
- `frameworkId` — Registered framework identifier
- `assessmentId` — Assessment identifier
- `overallScore` — Compliance score (0-100)
- `findings` — List of compliance findings
- `remediationPlan` — Remediation steps and timeline
