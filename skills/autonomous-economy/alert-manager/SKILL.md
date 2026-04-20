---
name: alert-manager
description: Alert routing, deduplication, and incident management
version: 1.0.0
price: 13.99
currency: USD
archetype: analyst
tags: [alerting, incidents, routing, notification]
---
# Alert Manager
Alert routing with deduplication, grouping, and multi-channel notification.
## Actions
### create-rule
Create an alert rule.
- **inputs**: ruleName, condition, severity, channels, cooldownMinutes
- **outputs**: ruleId, active
### fire-alert
Fire an alert manually.
- **inputs**: ruleId, message, labels
- **outputs**: incidentId, state
### acknowledge
Acknowledge a firing alert.
- **inputs**: incidentId, acknowledgedBy
- **outputs**: acknowledged, state
### resolve
Resolve an alert incident.
- **inputs**: incidentId, resolution
- **outputs**: resolved, resolvedAt
### silence-rule
Temporarily silence an alert rule.
- **inputs**: ruleId, durationMinutes, reason
- **outputs**: silenced, expiresAt
### export-incidents
Export incident history.
- **inputs**: configId, since, severity, format
- **outputs**: incidents[], mttr, totalFired
