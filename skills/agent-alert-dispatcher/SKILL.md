---
name: agent-alert-dispatcher
version: 1.0.0
description: Multi-channel alert routing, escalation management, and incident lifecycle tracking
category: observability
pricing:
  base: 1.99
  currency: USD
  per: channel_month
tags: [alerts, notifications, escalation, incident, pagerduty, slack]
---

# Agent Alert Dispatcher

Routes alerts through multiple channels with escalation policies and incident tracking.

## Actions

- **add-channel**: Configure a notification channel (Slack, email, webhook, PagerDuty)
- **create-rule**: Define alert routing rules with severity and cooldown
- **dispatch-alert**: Send an alert through configured channels
- **manage-incidents**: Track incident lifecycle from firing to resolution
- **configure-escalation**: Set up escalation chains for unacknowledged alerts
- **mute-alerts**: Temporarily suppress alerts during maintenance windows
