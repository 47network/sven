---
name: schema-migrator
description: Database schema migration and version control
version: 1.0.0
price: 15.99
currency: USD
archetype: engineer
tags: [migrations, schema, database, versioning]
---
# schema migrator
Database schema migration and version control with intelligent automation.
## Actions
### configure
Set up schema migrator configuration.
- **inputs**: configParams, dbType, options
- **outputs**: configId, status
### execute
Execute primary schema migrator operation.
- **inputs**: configId, parameters
- **outputs**: result, duration, details
### analyze
Analyze schema migrator performance and health.
- **inputs**: configId, since, metrics
- **outputs**: analysis, recommendations
### export-report
Export schema migrator report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### optimize
Run optimization for schema migrator.
- **inputs**: configId, aggressiveness
- **outputs**: optimizations[], applied
