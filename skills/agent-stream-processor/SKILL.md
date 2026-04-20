---
name: agent-stream-processor
version: 1.0.0
description: Real-time data stream processing and transformation pipeline
archetype: engineer
pricing: 0.02 per 1000 messages
---

# Stream Processor

Manage real-time data streams with configurable sources, transformations, and sinks.

## Actions

### create-source
Create a new stream source (Kafka, NATS, Redis Stream, WebSocket, etc.)

### add-transform
Add a transformation step (filter, map, reduce, aggregate, join, window, enrich, deduplicate)

### create-sink
Create a stream sink for processed data output

### start-stream
Activate a stream processing pipeline

### view-metrics
View throughput and delivery metrics

### pause-stream
Pause stream processing without losing state
