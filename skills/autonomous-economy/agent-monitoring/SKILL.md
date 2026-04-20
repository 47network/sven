---
skill: agent-monitoring-observability
name: Agent Monitoring & Observability
version: 1.0.0
description: Metric collection, alerting, dashboards, log aggregation, and SLO tracking for autonomous agents.
triggers:
  - metric_record
  - alert_create
  - alert_acknowledge
  - dashboard_create
  - log_query
  - slo_define
  - slo_check
---

# Agent Monitoring & Observability

Provides full observability into the autonomous economy agents — metrics, alerts, dashboards, structured logs, and SLO tracking.

## Actions

### `metric_record`
Record a metric data point for an agent.
- **Inputs**: `agent_id`, `metric_name`, `metric_type` (counter|gauge|histogram|summary|rate), `value`, `unit?`, `labels?`
- **Output**: Metric entry ID and confirmation

### `alert_create`
Create an alert rule for an agent with threshold conditions.
- **Inputs**: `agent_id`, `alert_name`, `severity` (info|warning|critical|emergency), `condition`, `threshold`, `message?`
- **Output**: Alert ID and initial status

### `alert_acknowledge`
Acknowledge or resolve a firing alert.
- **Inputs**: `alert_id`, `action` (acknowledge|resolve|silence)
- **Output**: Updated alert status

### `dashboard_create`
Create a monitoring dashboard with configurable panels.
- **Inputs**: `owner_id`, `title`, `description?`, `panels`, `layout?`, `refresh_interval_sec?`, `is_public?`
- **Output**: Dashboard ID and access URL

### `log_query`
Query structured log entries with filters.
- **Inputs**: `agent_id?`, `level?`, `trace_id?`, `source?`, `from?`, `to?`, `limit?`
- **Output**: Matching log entries

### `slo_define`
Define a Service Level Objective target for an agent.
- **Inputs**: `agent_id`, `slo_name`, `target_type` (availability|latency|error_rate|throughput|saturation), `target_value`, `window_hours?`
- **Output**: SLO target ID and initial budget

### `slo_check`
Check current SLO status and remaining error budget.
- **Inputs**: `slo_id`
- **Output**: Current value, budget remaining, status
