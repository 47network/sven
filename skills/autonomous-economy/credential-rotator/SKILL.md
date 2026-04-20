---
name: credential-rotator
description: Credential rotation and vault management
version: 1.0.0
price: 11.99
currency: USD
archetype: engineer
tags: [security, compliance, credential-rotator]
---
# credential rotator
Credential rotation and vault management with intelligent automation.
## Actions
### configure
Set up credential rotator configuration.
- **inputs**: configParams, options
- **outputs**: configId, status
### execute
Execute primary credential rotator operation.
- **inputs**: configId, parameters
- **outputs**: result, details
### analyze
Analyze credential rotator findings.
- **inputs**: configId, since, filters
- **outputs**: analysis, recommendations
### export-report
Export credential rotator report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### remediate
Apply credential rotator remediations.
- **inputs**: configId, items, autoApply
- **outputs**: remediated, failed, skipped
