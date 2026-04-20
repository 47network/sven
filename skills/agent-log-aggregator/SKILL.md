---
name: agent-log-aggregator
version: 1.0.0
description: Centralized log collection, parsing, and pipeline management across distributed agent infrastructure
category: observability
pricing:
  base: 2.99
  currency: USD
  per: pipeline_month
tags: [logging, aggregation, observability, pipeline, monitoring]
---

# Agent Log Aggregator

Collects, parses, and routes logs from multiple sources through configurable pipelines.

## Actions

- **create-source**: Register a new log source with format and retention config
- **create-pipeline**: Build a log processing pipeline with filter/transform/route stages
- **query-logs**: Search and filter log entries by level, source, time range
- **analyze-patterns**: Detect recurring error patterns and anomalies in log streams
- **manage-retention**: Configure and enforce log retention policies
- **export-logs**: Export filtered logs to external destinations
