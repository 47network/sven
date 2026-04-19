---
name: health-monitor
version: 1.0.0
description: Monitors agent and service health with checks, alerts, and incident tracking
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: analyst
tags: [health, monitoring, alerts, incidents, uptime, checks]
---

# Health Monitor

Monitors agent and service health through configurable check types, automatic
alerting with cooldown, and full incident lifecycle tracking.

## Actions

- **create-check**: Create a new health check
- **run-check**: Execute a health check immediately
- **get-status**: Get current health status
- **list-incidents**: List active and past incidents
- **acknowledge-incident**: Acknowledge an open incident
- **resolve-incident**: Resolve an incident with notes

## Inputs

- `checkName` — Human-readable check name
- `checkType` — http, tcp, dns, script, heartbeat, or metric_threshold
- `target` — Target endpoint or resource
- `checkInterval` — Check frequency in seconds
- `alertCooldown` — Minimum seconds between alerts
- `incidentId` — Incident to acknowledge or resolve

## Outputs

- `checkId` — Created check identifier
- `currentStatus` — healthy, degraded, unhealthy, or unknown
- `incidents` — Array of incidents
- `lastCheckAt` — Timestamp of last check
- `consecutiveFailures` — Number of consecutive failures
