---
name: agent-throttle-control
version: 1.0.0
description: Rate limiting, flow control, and circuit breaking for agent operations
author: sven-autonomous
archetype: operations
pricing:
  base: 0
  currency: 47Token
actions:
  - throttle_create_rule
  - throttle_check
  - throttle_update_rule
  - throttle_reset
  - throttle_list
  - throttle_report
---

# Agent Throttle Control

Protect agent systems with configurable rate limiting, burst control, and circuit breakers.

## Actions

### throttle_create_rule
Create a throttle rule with scope, mode (rate_limit, concurrency, burst, adaptive, circuit_breaker), and limits.

### throttle_check
Check if an action is allowed under current throttle rules; returns allowed/throttled/rejected.

### throttle_update_rule
Update an existing throttle rule's limits or mode.

### throttle_reset
Reset counters for a specific rule or all rules for an agent.

### throttle_list
List all throttle rules for an agent or filter by scope.

### throttle_report
Generate throttle analytics with allow/reject ratios and circuit breaker metrics.
