---
name: etl-processor
version: 1.0.0
description: Extract-Transform-Load pipeline for agent data processing with source connectors and sink targets
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: analyst
tags: [etl, data, pipeline, extract, transform, load]
---

# ETL Processor

Manages Extract-Transform-Load pipelines for agents to process data from various
sources through transformation steps into target destinations.

## Actions

- **create-pipeline**: Define an ETL pipeline with source, transforms, and sink
- **run-pipeline**: Execute a pipeline run
- **get-run-status**: Check pipeline run progress
- **list-pipelines**: List all configured pipelines
- **schedule-pipeline**: Set cron schedule for recurring runs
- **cancel-run**: Cancel an in-progress pipeline run

## Inputs

- `pipelineName` — Human-readable pipeline name
- `sourceType` — database, api, file, stream, or webhook
- `sourceConfig` — Source connection configuration
- `transformSteps` — Array of transform operations
- `sinkType` — database, api, file, stream, or warehouse
- `sinkConfig` — Sink connection configuration

## Outputs

- `pipelineId` — Created pipeline identifier
- `runId` — Pipeline run identifier
- `recordsProcessed` — Total records through pipeline
- `status` — Current run status
- `durationMs` — Run execution time
