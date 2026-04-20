---
name: uptime-monitor
description: Endpoint uptime monitoring and SLA tracking
version: 1.0.0
price: 9.99
currency: USD
archetype: analyst
tags: [uptime, monitoring, sla, health-check]
---
# Uptime Monitor
HTTP endpoint monitoring with SLA tracking and downtime alerts.
## Actions
### add-endpoint
Add an endpoint to monitor.
- **inputs**: url, method, headers, expectedStatus
- **outputs**: endpointId, currentState
### check-now
Run an immediate check on an endpoint.
- **inputs**: endpointId
- **outputs**: healthy, statusCode, responseMs
### get-uptime
Get uptime percentage for an endpoint.
- **inputs**: endpointId, since, until
- **outputs**: uptimePercent, totalChecks, downtime
### configure
Set up monitoring configuration.
- **inputs**: checkInterval, timeoutMs, alertAfterFailures
- **outputs**: configId, checkInterval
### list-incidents
List downtime incidents for an endpoint.
- **inputs**: endpointId, since, limit
- **outputs**: incidents[], totalDowntime
### export-sla-report
Export SLA compliance report.
- **inputs**: configId, period, format
- **outputs**: report, uptimePercent, slaCompliant
