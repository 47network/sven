---
name: compliance-auditor
description: Compliance framework auditing and reporting
version: 1.0.0
price: 19.99
currency: USD
archetype: analyst
tags: [security, compliance, compliance-auditor]
---
# compliance auditor
Compliance framework auditing and reporting with intelligent automation.
## Actions
### configure
Set up compliance auditor configuration.
- **inputs**: configParams, options
- **outputs**: configId, status
### execute
Execute primary compliance auditor operation.
- **inputs**: configId, parameters
- **outputs**: result, details
### analyze
Analyze compliance auditor findings.
- **inputs**: configId, since, filters
- **outputs**: analysis, recommendations
### export-report
Export compliance auditor report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### remediate
Apply compliance auditor remediations.
- **inputs**: configId, items, autoApply
- **outputs**: remediated, failed, skipped
