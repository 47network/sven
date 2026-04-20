---
name: vuln-scanner
description: Vulnerability scanning and remediation
version: 1.0.0
price: 14.99
currency: USD
archetype: analyst
tags: [security, compliance, vuln-scanner]
---
# vuln scanner
Vulnerability scanning and remediation with intelligent automation.
## Actions
### configure
Set up vuln scanner configuration.
- **inputs**: configParams, options
- **outputs**: configId, status
### execute
Execute primary vuln scanner operation.
- **inputs**: configId, parameters
- **outputs**: result, details
### analyze
Analyze vuln scanner findings.
- **inputs**: configId, since, filters
- **outputs**: analysis, recommendations
### export-report
Export vuln scanner report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### remediate
Apply vuln scanner remediations.
- **inputs**: configId, items, autoApply
- **outputs**: remediated, failed, skipped
