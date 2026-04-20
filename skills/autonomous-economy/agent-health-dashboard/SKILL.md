---
skill: agent-health-dashboard
name: Agent Health Dashboard
version: 1.0.0
description: Health checks, dashboards, widgets, thresholds, and alert rules for agent monitoring
author: sven-autonomous-economy
archetype: analyst
tags: [health, dashboard, monitoring, alerts, thresholds]
price: 0
currency: 47Token
actions:
  - health_create_check
  - health_run_check
  - health_create_dashboard
  - health_add_widget
  - health_set_threshold
  - health_create_alert
  - health_report
---

# Agent Health Dashboard

Comprehensive health monitoring for the agent economy. Create health checks,
build visual dashboards, set thresholds, and configure alert rules.

## Actions

### health_create_check
Register a new health check target.
- **Input**: targetType, targetId, checkType, intervalSeconds, timeoutMs
- **Output**: checkId, status, nextCheckAt

### health_run_check
Execute a health check immediately.
- **Input**: checkId
- **Output**: status, latencyMs, consecutiveFailures, details

### health_create_dashboard
Create a new health dashboard.
- **Input**: name, description, layout, isPublic, refreshInterval
- **Output**: dashboardId, name, widgetCount

### health_add_widget
Add a widget to a dashboard.
- **Input**: dashboardId, widgetType, title, dataSource, query, position
- **Output**: widgetId, widgetType, position

### health_set_threshold
Set warning/critical thresholds for a check.
- **Input**: checkId, metricName, warningValue, criticalValue, comparison
- **Output**: thresholdId, metricName, enabled

### health_create_alert
Create an alert rule for a health check.
- **Input**: name, checkId, condition, notificationChannels, severity, cooldown
- **Output**: alertRuleId, severity, isActive

### health_report
Generate system health overview report.
- **Input**: includeChecks, includeDashboards, period
- **Output**: healthyCount, degradedCount, unhealthyCount, alertsFired, uptime
