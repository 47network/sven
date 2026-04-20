---
name: alert-router
version: 1.0.0
description: Routes alerts to channels based on severity, rules, and escalation policies
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: manager
tags: [alerts, routing, escalation, notification, severity, channels]
---

# Alert Router

Routes alerts through configurable channels based on severity levels, matching rules,
cooldown periods, and escalation policies with suppression support.

## Actions

- **create-rule**: Define an alert routing rule with conditions and channels
- **fire-alert**: Fire an alert that matches against rules
- **list-rules**: List all configured alert rules
- **get-history**: Get alert delivery history
- **update-rule**: Modify an existing alert rule
- **suppress-alert**: Add a temporary suppression rule

## Inputs

- `ruleName` — Human-readable rule name
- `condition` — JSON condition expression
- `severity` — critical, high, medium, low, or info
- `channels` — Array of delivery channels
- `cooldownSeconds` — Minimum time between repeated alerts
- `escalationPolicy` — Escalation chain configuration

## Outputs

- `ruleId` — Created rule identifier
- `alertId` — Fired alert identifier
- `delivered` — Delivery confirmation boolean
- `channel` — Channel used for delivery
- `history` — Array of alert history entries
