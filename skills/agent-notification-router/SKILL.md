---
name: agent-notification-router
version: 1.0.0
description: Multi-channel notification routing with severity-based escalation and delivery tracking
author: sven-platform
pricing:
  base: 0.05
  currency: "47T"
  per: "notification sent"
tags: [notifications, alerts, routing, escalation, multi-channel]
inputs:
  - channelType: email | slack | webhook | sms | discord | telegram | pagerduty
  - severity: info | warning | error | critical
  - title: string
  - body: string
  - escalationPolicy: object
outputs:
  - notificationId: string
  - deliveryStatus: string
  - channelUsed: string
  - escalated: boolean
actions:
  - create-channel
  - create-rule
  - send-notification
  - get-delivery-status
  - list-channels
  - notification-stats
archetype: engineer
---

# Agent Notification Router

Routes notifications across multiple channels with severity-based rules, cooldown periods, and automatic escalation.

## Capabilities
- Seven channel types: email, Slack, webhook, SMS, Discord, Telegram, PagerDuty
- Severity-based routing rules (info, warning, error, critical)
- Cooldown periods to prevent notification storms
- Automatic escalation to backup channels after timeout
- Full delivery tracking with status history
