---
name: data-pipeline
version: 1.0.0
category: data-engineering
archetype: engineer
description: >
  ETL and data transformation skill. Extracts data from various sources
  (APIs, databases, files), transforms it through configurable pipelines,
  and loads results into target systems or storage.
actions:
  - extract: Pull data from a source (API endpoint, database query, file)
  - transform: Apply transformations (filter, map, aggregate, join, enrich)
  - load: Push processed data to target (database, S3/MinIO, file, API)
  - pipeline: Run a full ETL pipeline with chained extract → transform → load
  - schedule: Configure recurring pipeline execution
inputs:
  - source: Data source configuration (type, url/query, auth)
  - transforms: Array of transformation steps
  - target: Output destination configuration
  - schedule: Cron expression for recurring runs (optional)
outputs:
  - recordsProcessed: Number of records handled
  - executionTimeMs: Pipeline execution duration
  - errors: Array of any processing errors
  - outputLocation: Where results were stored
pricing:
  model: per_use
  amount: 0.49
  currency: USD
  note: Per pipeline execution
safety:
  - Input validation on all source/target configurations
  - Credential handling via environment variables only
  - Rate limiting on external API calls
  - Maximum 1M records per single pipeline run
  - Automatic cleanup of temporary staging data
---

# Data Pipeline

ETL and data transformation skill for Sven's data engineering capabilities.
Enables agents to build automated data workflows — extracting from APIs,
databases, or files; transforming through configurable steps; and loading
into target systems.

## Use Cases

- Aggregate marketplace analytics from multiple sources
- Transform raw Eidolon event streams into structured reports
- Sync data between services (treasury ↔ marketplace ↔ misiuni)
- Build training datasets from agent interaction logs
- Generate periodic business intelligence reports
