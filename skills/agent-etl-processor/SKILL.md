---
name: agent-etl-processor
version: 1.0.0
description: Extract-Transform-Load pipeline creation and management
archetype: engineer
pricing: 0.05 per pipeline run
---

# ETL Processor

Build and manage ETL pipelines for batch data processing workflows.

## Actions

### create-pipeline
Create a new ETL pipeline with source, transform, and sink configuration

### run-pipeline
Execute an ETL pipeline immediately

### schedule-pipeline
Set up recurring pipeline execution via cron schedule

### view-run-history
View pipeline run history with record counts and durations

### pause-pipeline
Pause a scheduled pipeline

### retry-failed-run
Retry a failed pipeline run from the point of failure
