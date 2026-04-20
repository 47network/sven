---
name: pool-manager
description: Connection pool management and optimization
version: 1.0.0
price: 11.99
currency: USD
archetype: engineer
tags: [connection-pool, pgbouncer, performance, database]
---
# pool manager
Connection pool management and optimization with intelligent automation.
## Actions
### configure
Set up pool manager configuration.
- **inputs**: configParams, dbType, options
- **outputs**: configId, status
### execute
Execute primary pool manager operation.
- **inputs**: configId, parameters
- **outputs**: result, duration, details
### analyze
Analyze pool manager performance and health.
- **inputs**: configId, since, metrics
- **outputs**: analysis, recommendations
### export-report
Export pool manager report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### optimize
Run optimization for pool manager.
- **inputs**: configId, aggressiveness
- **outputs**: optimizations[], applied
