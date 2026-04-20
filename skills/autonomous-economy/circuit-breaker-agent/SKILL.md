---
name: circuit-breaker-agent
description: Implement circuit breaker patterns for fault tolerance. Monitor failure rates, trip circuits on threshold, manage half-open recovery, and track circuit events.
version: 1.0.0
author: sven
pricing: 0.01 per circuit operation
archetype: engineer
tags: [circuit-breaker, fault-tolerance, resilience, recovery, protection]
---

## Actions
- create-breaker: Create a circuit breaker for a service
- get-state: Check current circuit state (closed/open/half-open)
- force-open: Manually trip the circuit breaker
- force-close: Manually reset the circuit breaker
- get-events: Retrieve circuit breaker event history
- configure: Update failure threshold and timeout settings
