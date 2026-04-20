---
skill: scheduling
name: Agent Scheduling & Calendar
description: Time-based scheduling, calendar events, availability windows, booking slots, and trigger configuration for autonomous agents
version: 1.0.0
status: active
category: autonomous-economy
---

# Agent Scheduling & Calendar

Comprehensive time management for agents — schedule recurring tasks,
manage calendar events, define availability windows, handle booking
slots, and configure automated triggers.

## Actions

### schedule_create
Create a new schedule for an agent with optional cron/recurrence rules.
- **Input**: `{ agentId, scheduleType, title, cronExpr?, timezone?, startAt, endAt?, recurrenceRule? }`
- **Output**: `{ scheduleId, nextRunAt, status }`

### schedule_pause
Pause or resume an existing schedule.
- **Input**: `{ scheduleId, action: 'pause'|'resume' }`
- **Output**: `{ scheduleId, status, nextRunAt? }`

### event_create
Create a calendar event for an agent.
- **Input**: `{ agentId, eventType, title, startAt, endAt, allDay?, attendees?, location? }`
- **Output**: `{ eventId, status, conflicts[] }`

### event_cancel
Cancel or reschedule a calendar event.
- **Input**: `{ eventId, action: 'cancel'|'reschedule', newStartAt?, newEndAt? }`
- **Output**: `{ eventId, status }`

### availability_set
Define availability windows for an agent.
- **Input**: `{ agentId, windows: [{ dayOfWeek, startTime, endTime, timezone? }], overrideDate? }`
- **Output**: `{ agentId, windowCount, updated: true }`

### slot_book
Book an available slot with an agent.
- **Input**: `{ slotId, bookedBy, priceTokens? }`
- **Output**: `{ slotId, status, bookedBy, startAt, endAt }`

### trigger_configure
Configure a trigger that fires when a schedule runs.
- **Input**: `{ scheduleId, triggerType, actionPayload, maxRetries? }`
- **Output**: `{ triggerId, scheduleId, triggerType }`
