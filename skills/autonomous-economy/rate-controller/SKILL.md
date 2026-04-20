---
name: rate-controller
description: Rate limiting and traffic throttling controller for API protection
version: 1.0.0
price: 13.99
currency: USD
archetype: engineer
category: networking
tags: [rate-limiting, throttling, api-protection, traffic-control]
---

# Rate Controller

Implements intelligent rate limiting with multiple algorithms, burst handling, and per-client traffic control for API and service protection.

## Actions

### create-rule
Create a rate limiting rule with configurable limits, burst sizes, and window durations.

### update-limits
Dynamically adjust rate limits based on traffic patterns or manual override.

### check-status
Check current rate limit status for a specific client or rule, including remaining tokens.

### block-client
Temporarily block a client that has exceeded rate limits or triggered abuse detection.

### analytics-report
Generate rate limiting analytics with top offenders, limit utilization, and trend data.

### configure-algorithm
Switch between rate limiting algorithms (token bucket, sliding window, fixed window, leaky bucket).
