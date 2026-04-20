---
name: agent-rate-limiting
version: 1.0.0
description: Configure and monitor rate limiting policies across services
triggers:
  - ratelimit_create_policy
  - ratelimit_update_policy
  - ratelimit_check_status
  - ratelimit_add_override
  - ratelimit_list_blocked
  - ratelimit_report
pricing:
  model: per_action
  base: 0.10
archetype: engineer
---
# Rate Limiting Skill
Configures rate limiting with multiple scopes, throttle strategies, burst limits, and per-identifier overrides for API protection.
