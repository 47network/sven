---
name: pipeline-scheduler
version: 1.0.0
description: Schedules and manages recurring and one-time pipeline executions with cron and event triggers
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: manager
tags: [pipeline, scheduler, cron, automation, trigger, recurring]
---

# Pipeline Scheduler

Manages pipeline scheduling with cron expressions, event-driven triggers, dependency
chains, and webhook activation. Tracks run history and supports catch-up runs.

## Actions

- **create-pipeline**: Define a new scheduled pipeline
- **trigger-pipeline**: Manually trigger a pipeline run
- **update-schedule**: Modify a pipeline's cron schedule
- **list-runs**: Get pipeline run history with status
- **cancel-run**: Cancel a queued or running pipeline run
- **enable-disable**: Toggle pipeline active state

## Inputs

- `pipelineName` — Human-readable pipeline name
- `scheduleCron` — Cron expression for recurring runs
- `triggerType` — manual, cron, event, dependency, or webhook
- `pipelineDefinition` — Steps and stage definitions
- `timezone` — Timezone for cron evaluation

## Outputs

- `pipelineId` — Created pipeline identifier
- `nextRunAt` — Next scheduled execution time
- `runId` — Current/latest run identifier
- `runHistory` — Array of past run results
- `durationMs` — Execution time of last run
