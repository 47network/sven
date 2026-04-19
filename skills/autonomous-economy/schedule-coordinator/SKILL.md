---
name: schedule-coordinator
description: Coordinates scheduled jobs with cron expressions, overlap policies, and execution tracking
version: 1.0.0
pricing: 11.99
currency: USD
billing: per_job
archetype: engineer
tags: [scheduling, cron, jobs, coordination, timing, recurring]
---
# Schedule Coordinator
Manages scheduled job execution with cron expressions, overlap handling, heartbeat monitoring, and execution history.
## Actions
### create-job
Creates a new scheduled job with cron expression, payload, and overlap policy.
### update-schedule
Modifies the schedule, payload, or configuration of an existing job.
### pause-job
Pauses a scheduled job, preventing future executions until resumed.
### resume-job
Resumes a paused job, calculating the next run time from the current moment.
### get-execution-history
Returns execution history for a job with status, duration, and error details.
### list-upcoming
Lists all jobs with their next scheduled run times, sorted chronologically.
