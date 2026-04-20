---
name: query-tuner
description: SQL query analysis and optimization
version: 1.0.0
price: 16.99
currency: USD
archetype: analyst
tags: [sql, optimization, performance, indexing]
---
# query tuner
SQL query analysis and optimization with intelligent automation.
## Actions
### configure
Set up query tuner configuration.
- **inputs**: configParams, dbType, options
- **outputs**: configId, status
### execute
Execute primary query tuner operation.
- **inputs**: configId, parameters
- **outputs**: result, duration, details
### analyze
Analyze query tuner performance and health.
- **inputs**: configId, since, metrics
- **outputs**: analysis, recommendations
### export-report
Export query tuner report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### optimize
Run optimization for query tuner.
- **inputs**: configId, aggressiveness
- **outputs**: optimizations[], applied
