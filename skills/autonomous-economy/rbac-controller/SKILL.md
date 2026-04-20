---
name: rbac-controller
description: Role-based access control management
version: 1.0.0
price: 13.99
currency: USD
archetype: engineer
tags: [security, compliance, rbac-controller]
---
# rbac controller
Role-based access control management with intelligent automation.
## Actions
### configure
Set up rbac controller configuration.
- **inputs**: configParams, options
- **outputs**: configId, status
### execute
Execute primary rbac controller operation.
- **inputs**: configId, parameters
- **outputs**: result, details
### analyze
Analyze rbac controller findings.
- **inputs**: configId, since, filters
- **outputs**: analysis, recommendations
### export-report
Export rbac controller report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### remediate
Apply rbac controller remediations.
- **inputs**: configId, items, autoApply
- **outputs**: remediated, failed, skipped
