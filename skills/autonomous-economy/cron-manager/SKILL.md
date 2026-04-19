---
name: cron-manager
description: Centralized cron job management with expression validation, execution logging, failure notifications, and timezone coordination
version: 1.0.0
price: 9.99
currency: USD
archetype: engineer
inputs:
  - expression
  - command
  - timezone
  - description
outputs:
  - entryId
  - nextTrigger
  - triggerCount
  - logs
---

# Cron Manager

Centralized cron job management platform with expression validation, detailed execution logging, failure notifications, and multi-timezone coordination for distributed agent operations.

## Actions

- **add-cron** — Register a new cron entry with expression and command
- **validate-expression** — Validate and explain a cron expression
- **list-crons** — List all registered cron entries with status
- **view-logs** — View execution logs for a specific cron entry
- **toggle-status** — Enable, pause, or disable cron entries
- **bulk-manage** — Batch operations on multiple cron entries
