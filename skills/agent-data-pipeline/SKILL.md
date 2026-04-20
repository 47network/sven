---
name: agent-data-pipeline
version: 1.0.0
description: ETL/ELT workflow orchestration, data transformations, and pipeline monitoring
author: sven-platform
pricing:
  base: 0.50
  currency: "47T"
  per: "pipeline run"
tags: [data-pipeline, etl, elt, transformations, data-engineering]
inputs:
  - pipelineName: string
  - pipelineType: etl | elt | streaming | batch | cdc
  - sourceType: string
  - sinkType: string
  - transforms: array
  - scheduleCron: string
outputs:
  - pipelineId: string
  - recordsProcessed: number
  - runStatus: string
  - durationMs: number
actions:
  - create-pipeline
  - run-pipeline
  - add-transform
  - get-run-status
  - list-pipelines
  - pipeline-stats
archetype: engineer
---

# Agent Data Pipeline

Orchestrates ETL/ELT workflows with configurable data transformations, scheduled execution, and pipeline monitoring.

## Capabilities
- ETL, ELT, streaming, batch, and CDC pipeline types
- Multiple source connectors (Postgres, MySQL, S3, APIs, Kafka, files, webhooks)
- Multiple sink connectors (Postgres, OpenSearch, S3, APIs, Kafka, warehouses)
- Transform chain: map, filter, aggregate, join, enrich, deduplicate, validate
- Cron-based scheduling with run history and failure tracking
