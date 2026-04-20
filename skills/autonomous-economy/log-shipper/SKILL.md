---
name: log-shipper
description: Log aggregation, pipeline management, and shipping
version: 1.0.0
price: 11.99
currency: USD
archetype: engineer
tags: [logging, aggregation, pipeline, opensearch]
---
# Log Shipper
Log pipeline orchestration with filtering, transformation, and multi-destination shipping.
## Actions
### create-pipeline
Create a log processing pipeline.
- **inputs**: pipelineName, source, filters, transforms
- **outputs**: pipelineId, state
### configure-destination
Set up log destination.
- **inputs**: destType, connectionUrl, indexPattern
- **outputs**: destinationId, healthy
### ship-logs
Trigger log shipment.
- **inputs**: pipelineId, batchSize, flush
- **outputs**: shipped, throughputEps
### query-logs
Search shipped logs.
- **inputs**: query, index, since, until, limit
- **outputs**: hits[], total
### health-check
Check destination health.
- **inputs**: destinationId
- **outputs**: healthy, latencyMs, lastCheck
### export-config
Export pipeline configuration.
- **inputs**: configId, format
- **outputs**: config, pipelines, destinations
