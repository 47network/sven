---
skill: agent-rate-limiting
name: Agent Rate Limiting
version: 1.0.0
description: Rate limiting policies, quotas, throttling rules, and violation tracking
author: sven-autonomous-economy
archetype: analyst
tags: [rate-limiting, throttling, quotas, policies, violations]
price: 0
currency: 47Token
actions:
  - ratelimit_create_policy
  - ratelimit_set_quota
  - ratelimit_add_throttle
  - ratelimit_check
  - ratelimit_track_usage
  - ratelimit_resolve_violation
  - ratelimit_report
---

# Agent Rate Limiting

Rate limiting policies with quotas, throttle rules, usage tracking,
and violation management for agents, services, and APIs.

## Actions

### ratelimit_create_policy
Create a rate limiting policy.
- **Input**: name, targetType, targetId, requestsPerMinute, strategy, burstLimit
- **Output**: policyId, name, targetType, strategy, status

### ratelimit_set_quota
Set a quota on a policy.
- **Input**: policyId, resourceType, quotaLimit, resetInterval
- **Output**: quotaId, resourceType, quotaLimit, resetInterval

### ratelimit_add_throttle
Add a throttle rule to a policy.
- **Input**: policyId, condition, action, delayMs, priority
- **Output**: ruleId, action, priority, isActive

### ratelimit_check
Check if a request is allowed by rate limits.
- **Input**: policyId, targetId, requestType
- **Output**: allowed, remaining, retryAfter, quotaStatus

### ratelimit_track_usage
Record usage for rate limit tracking.
- **Input**: policyId, requestCount, tokenCount
- **Output**: recorded, currentUsage, windowRemaining

### ratelimit_resolve_violation
Resolve a rate limit violation.
- **Input**: violationId, resolution, notes
- **Output**: violationId, resolved, resolvedAt

### ratelimit_report
Generate rate limiting report.
- **Input**: policyId, dateRange
- **Output**: totalRequests, rejectedRequests, violations, quotaUtilization
