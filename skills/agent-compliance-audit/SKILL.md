---
name: agent-compliance-audit
version: 1.0.0
description: Assess compliance against GDPR, SOC2, HIPAA, PCI-DSS, ISO27001 frameworks
triggers:
  - compliance_create_framework
  - compliance_assess_control
  - compliance_run_audit
  - compliance_generate_report
  - compliance_list_findings
  - compliance_report
pricing:
  model: per_audit
  base: 5.00
archetype: analyst
---
# Compliance Audit Skill
Assesses infrastructure and processes against compliance frameworks. Generates audit reports with scoring, findings, and remediation guidance.
