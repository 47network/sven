---
name: replication-manager
description: Database replication and failover management
version: 1.0.0
price: 18.99
currency: USD
archetype: engineer
tags: [replication, failover, high-availability, streaming]
---
# replication manager
Database replication and failover management with intelligent automation.
## Actions
### configure
Set up replication manager configuration.
- **inputs**: configParams, dbType, options
- **outputs**: configId, status
### execute
Execute primary replication manager operation.
- **inputs**: configId, parameters
- **outputs**: result, duration, details
### analyze
Analyze replication manager performance and health.
- **inputs**: configId, since, metrics
- **outputs**: analysis, recommendations
### export-report
Export replication manager report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### optimize
Run optimization for replication manager.
- **inputs**: configId, aggressiveness
- **outputs**: optimizations[], applied
