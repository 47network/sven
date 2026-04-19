---
name: process-monitor
description: Monitors running processes for health, resource usage, and anomalies with alerting and auto-restart
version: 1.0.0
pricing: 13.99
currency: USD
billing: per_process
archetype: engineer
tags: [monitoring, processes, health, alerts, resources, auto-restart]
---
# Process Monitor
Monitors running processes for health, resource consumption, and anomalies with configurable alerting and auto-restart.
## Actions
### register-process
Registers a process for monitoring with health check configuration and thresholds.
### check-health
Performs an immediate health check on a monitored process, returning status and metrics.
### get-metrics
Returns resource usage metrics (CPU, memory, disk IO) for a monitored process.
### list-alerts
Lists active and historical alerts for monitored processes with filtering.
### acknowledge-alert
Acknowledges an alert, marking it as reviewed without resolving the underlying issue.
### configure-thresholds
Updates alert thresholds and auto-restart settings for a monitored process.
