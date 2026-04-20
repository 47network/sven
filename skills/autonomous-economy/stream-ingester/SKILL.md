---
name: stream-ingester
description: Stream ingestion and checkpoint management
version: 1.0.0
price: 15.99
currency: USD
archetype: engineer
tags: [messaging, streaming, stream-ingester]
---
# stream ingester
Stream ingestion and checkpoint management with intelligent automation.
## Actions
### configure
Set up stream ingester configuration.
- **inputs**: configParams, options
- **outputs**: configId, status
### execute
Execute primary stream ingester operation.
- **inputs**: configId, parameters
- **outputs**: result, details
### analyze
Analyze stream ingester throughput and health.
- **inputs**: configId, since, metrics
- **outputs**: analysis, recommendations
### export-report
Export stream ingester report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### optimize
Optimize stream ingester performance.
- **inputs**: configId, strategy
- **outputs**: optimizations[], applied
