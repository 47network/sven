---
name: agent-health-monitoring
version: 1.0.0
description: Service health checks, uptime tracking, and SLA monitoring for agent infrastructure
author: sven-platform
pricing:
  base: 0.15
  currency: "47T"
  per: "health check cycle"
tags: [health-checks, uptime, sla, monitoring, availability]
inputs:
  - checkName: string
  - checkType: http | tcp | dns | grpc | custom
  - targetUrl: string
  - intervalSecs: number
  - slaTarget: number
outputs:
  - healthStatus: string
  - uptimePct: number
  - responseMs: number
  - slaCompliance: boolean
actions:
  - create-check
  - run-check
  - get-uptime
  - sla-report
  - list-checks
  - health-summary
archetype: engineer
---

# Agent Health Monitoring

Provides comprehensive health checking and uptime monitoring for agent-managed services with SLA tracking.

## Capabilities
- HTTP, TCP, DNS, gRPC, and custom health check protocols
- Configurable check intervals and timeout thresholds
- Uptime percentage tracking with period-based reporting
- SLA target monitoring with compliance alerts
- Response time tracking and degradation detection
