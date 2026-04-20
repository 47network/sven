---
name: agent-api-versioning
triggers:
  - apiver_publish_version
  - apiver_deprecate_endpoint
  - apiver_check_compat
  - apiver_notify_consumers
  - apiver_sunset_version
  - apiver_report
intents:
  - Manage API version lifecycle from draft to retirement
  - Track endpoint deprecations and sunset schedules
  - Run compatibility checks between API versions
outputs:
  - Version publish confirmations
  - Deprecation notices and migration guides
  - Compatibility check reports
---

# Agent API Versioning

Manages the full lifecycle of API versions including publishing, deprecation scheduling, compatibility checking, and consumer notification.
