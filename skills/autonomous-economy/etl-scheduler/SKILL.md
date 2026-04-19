---
name: etl-scheduler
version: 1.0.0
description: Schedule and manage recurring ETL jobs with cron expressions, dependency chains, and failure alerting
author: sven-autonomous-economy
price: 16.99
currency: USD
archetype: engineer
tags: [scheduling, etl, cron, automation, workflow]
---

# ETL Scheduler

Schedule and manage recurring ETL jobs using cron expressions with support for dependency chains, missed run policies, failure alerting, and run history tracking.

## Actions

### create_schedule
Create a new ETL schedule with cron expression and pipeline reference.

### update_schedule
Modify an existing schedule's timing or configuration.

### trigger_run
Manually trigger an immediate run of a scheduled job.

### get_run_history
Retrieve execution history for a schedule with status and metrics.

### pause_schedule
Pause a schedule to prevent future runs.

### list_schedules
List all schedules with next run times and status.
