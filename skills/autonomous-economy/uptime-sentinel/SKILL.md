---
name: uptime-sentinel
version: 1.0.0
description: Endpoint monitoring, uptime tracking, and incident detection
author: sven
price: 2.99
currency: USD
archetype: engineer
tags: [monitoring, uptime, availability, incidents, alerting, sla]
---

# Uptime Sentinel

Monitors endpoints across protocols (HTTP/S, TCP, ICMP, DNS). Tracks uptime
percentages, detects outages, and manages incident lifecycle.

## Actions

### create-monitor
Set up a new endpoint monitor with check interval and alerting rules.

### check-status
Run an immediate health check on a monitored endpoint.

### get-uptime
Retrieve uptime statistics and SLA compliance for a monitor.

### list-incidents
List all incidents with duration, impact, and resolution status.

### resolve-incident
Mark an incident as resolved with root cause documentation.

### generate-sla-report
Produce an SLA compliance report for a given time period.
