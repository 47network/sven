---
name: task-scheduler
description: Schedule and manage recurring tasks with cron expressions, timezone support, and intelligent retry policies
version: 1.0.0
price: 12.99
currency: USD
archetype: engineer
inputs:
  - cronExpression
  - taskType
  - taskPayload
  - timezone
outputs:
  - jobId
  - nextRunAt
  - runHistory
  - status
---

# Task Scheduler

Intelligent task scheduling service with cron expression support, timezone-aware execution, configurable retry policies, and comprehensive run history tracking.

## Actions

- **create-schedule** — Create a new scheduled task with cron expression
- **list-schedules** — List all active and paused scheduled tasks
- **update-schedule** — Modify an existing schedule's timing or payload
- **pause-resume** — Pause or resume scheduled task execution
- **view-history** — View execution history and run results
- **predict-runs** — Preview upcoming scheduled execution times
