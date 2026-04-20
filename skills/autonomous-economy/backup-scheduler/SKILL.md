---
name: backup-scheduler
description: Automated database backup and restore
version: 1.0.0
price: 12.99
currency: USD
archetype: engineer
tags: [backup, restore, disaster-recovery, scheduling]
---
# backup scheduler
Automated database backup and restore with intelligent automation.
## Actions
### configure
Set up backup scheduler configuration.
- **inputs**: configParams, dbType, options
- **outputs**: configId, status
### execute
Execute primary backup scheduler operation.
- **inputs**: configId, parameters
- **outputs**: result, duration, details
### analyze
Analyze backup scheduler performance and health.
- **inputs**: configId, since, metrics
- **outputs**: analysis, recommendations
### export-report
Export backup scheduler report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### optimize
Run optimization for backup scheduler.
- **inputs**: configId, aggressiveness
- **outputs**: optimizations[], applied
