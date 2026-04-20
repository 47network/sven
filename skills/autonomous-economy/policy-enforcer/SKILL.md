---
name: policy-enforcer
description: Policy enforcement and decision logging
version: 1.0.0
price: 15.99
currency: USD
archetype: analyst
tags: [security, compliance, policy-enforcer]
---
# policy enforcer
Policy enforcement and decision logging with intelligent automation.
## Actions
### configure
Set up policy enforcer configuration.
- **inputs**: configParams, options
- **outputs**: configId, status
### execute
Execute primary policy enforcer operation.
- **inputs**: configId, parameters
- **outputs**: result, details
### analyze
Analyze policy enforcer findings.
- **inputs**: configId, since, filters
- **outputs**: analysis, recommendations
### export-report
Export policy enforcer report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### remediate
Apply policy enforcer remediations.
- **inputs**: configId, items, autoApply
- **outputs**: remediated, failed, skipped
