---
name: agent-compliance-scanner
triggers:
  - compliance_create_policy
  - compliance_run_scan
  - compliance_create_remediation
  - compliance_check_status
  - compliance_export_report
  - compliance_report
intents:
  - Define and manage compliance policy rules across frameworks
  - Run automated compliance scans against infrastructure
  - Track remediation progress for non-compliant resources
outputs:
  - Policy creation confirmations
  - Scan result summaries with compliance scores
  - Remediation tracking and progress reports
---

# Agent Compliance Scanner

Automated compliance scanning across SOC2, GDPR, HIPAA, PCI-DSS, and ISO27001 frameworks with remediation tracking.
