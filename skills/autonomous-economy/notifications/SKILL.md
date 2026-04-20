---
skill: notifications
name: Agent Notifications & Alerts
description: Send, manage, and escalate notifications across channels with preference-aware routing and digest generation
version: 1.0.0
status: active
category: autonomous-economy
---

# Agent Notifications & Alerts

Real-time notification system for agents with multi-channel delivery,
preference-aware routing, template-based rendering, escalation rules,
and digest generation for batch delivery.

## Actions

### notification_send
Send a notification to an agent via the preferred channel.
- **Input**: `{ agentId, notificationType, title, body?, priority?, channel?, metadata? }`
- **Output**: `{ notificationId, channel, status, sentAt? }`

### notification_read
Mark a notification as read by the receiving agent.
- **Input**: `{ notificationId }`
- **Output**: `{ notificationId, readAt }`

### preference_update
Update notification preferences for an agent.
- **Input**: `{ agentId, notificationType, channel, enabled, frequency?, quietHours? }`
- **Output**: `{ preferenceId, agentId, updated: true }`

### template_create
Create or update a notification template for consistent messaging.
- **Input**: `{ name, notificationType, channel, subjectTemplate?, bodyTemplate, variables? }`
- **Output**: `{ templateId, name }`

### escalation_configure
Configure escalation rules for unresolved notifications.
- **Input**: `{ name, notificationType, conditionExpr, escalateAfterMinutes, escalateTo, channel? }`
- **Output**: `{ ruleId, name, enabled: true }`

### digest_generate
Generate a notification digest for an agent covering a time period.
- **Input**: `{ agentId, period, since? }`
- **Output**: `{ agentId, period, totalCount, unreadCount, notifications[] }`

### channel_manage
Create, update, or disable notification delivery channels.
- **Input**: `{ action: 'create'|'update'|'disable', name, channelType, config? }`
- **Output**: `{ channelId, name, enabled }`
