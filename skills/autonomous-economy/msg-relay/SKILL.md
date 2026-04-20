---
name: msg-relay
description: Message relay and dead-letter queue management
version: 1.0.0
price: 13.99
currency: USD
archetype: engineer
tags: [messaging, streaming, msg-relay]
---
# msg relay
Message relay and dead-letter queue management with intelligent automation.
## Actions
### configure
Set up msg relay configuration.
- **inputs**: configParams, options
- **outputs**: configId, status
### execute
Execute primary msg relay operation.
- **inputs**: configId, parameters
- **outputs**: result, details
### analyze
Analyze msg relay throughput and health.
- **inputs**: configId, since, metrics
- **outputs**: analysis, recommendations
### export-report
Export msg relay report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### optimize
Optimize msg relay performance.
- **inputs**: configId, strategy
- **outputs**: optimizations[], applied
