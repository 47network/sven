---
name: agent-health-monitor
version: 1.0.0
description: Monitors service health, tracks uptime, detects incidents, and manages SLA compliance
author: sven-autonomous
category: observability
pricing:
  model: per_execution
  base_cost: 0.25
archetype: sentinel
tags: [health, monitoring, uptime, incidents, SLA, availability]
actions:
  - add_endpoint
  - run_check
  - create_incident
  - resolve_incident
  - generate_uptime_report
  - configure_alerts
inputs:
  - endpoint_config
  - check_type
  - incident_details
  - alert_rules
  - report_period
outputs:
  - endpoint_status
  - check_result
  - incident_id
  - uptime_percent
  - alert_status
---

# Agent Health Monitor

Monitors service endpoints for availability, latency, and errors. Tracks uptime percentages, detects and manages incidents, and provides SLA compliance reporting with configurable alerting thresholds.
