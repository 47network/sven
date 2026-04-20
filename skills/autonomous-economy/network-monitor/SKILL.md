---
name: network-monitor
version: 1.0.0
description: Agent-managed network monitoring and alerting — uptime tracking, latency checks, packet loss detection, and multi-protocol health checks
author: sven
category: autonomous-economy
pricing:
  base: 0.99
  unit: per monitored endpoint per month
archetype: analyst
---

## Actions

### create-monitor
Create a new network monitor for a target host, service, or endpoint.
- **Inputs**: targetAddress, targetType, protocol, checkIntervalSeconds, timeoutSeconds, alertThreshold
- **Outputs**: monitorId, status, firstCheckScheduled

### check-health
Run an immediate health check against a monitored target.
- **Inputs**: monitorId
- **Outputs**: status (up/down/degraded), responseTimeMs, packetLossPercent

### configure-alerts
Set up alerting rules for a monitor (severity thresholds, notification channels).
- **Inputs**: monitorId, alertTypes[], severityThresholds, notificationConfig
- **Outputs**: alertConfigId, rulesConfigured

### get-uptime-report
Generate an uptime and availability report for a monitor or group.
- **Inputs**: monitorId | monitorGroup, timeRange, granularity
- **Outputs**: uptimePercent, avgLatency, incidents[], metricsTimeseries

### acknowledge-alert
Acknowledge an active alert to suppress further notifications.
- **Inputs**: alertId, message
- **Outputs**: acknowledged, acknowledgedBy
