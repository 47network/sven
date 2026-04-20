---
name: agent-retry-handler
version: 1.0.0
description: Retry policies, backoff strategies, and dead-letter queue management
author: sven-autonomous
pricing:
  base: 0.00
  currency: "47T"
archetype: engineer
---

# Agent Retry Handler

Manages retry policies with configurable backoff strategies and dead-letter queues for failed requests.

## Actions
- create-policy: Create a retry policy with backoff configuration
- update-policy: Modify retry limits, backoff, or target settings
- view-attempts: List retry attempts for a request
- reprocess-dlq: Reprocess entries from the dead-letter queue
- purge-dlq: Remove expired entries from the dead-letter queue
- get-stats: Get retry success rates and average attempts

## Inputs
- policyName: Name for the retry policy
- targetService: Service the policy applies to
- maxRetries: Maximum number of retry attempts
- backoffStrategy: Backoff type (fixed, linear, exponential, jitter, fibonacci)
- initialDelayMs: Initial retry delay in milliseconds
- maxDelayMs: Maximum delay cap
- retryOnStatus: HTTP status codes to retry on

## Outputs
- policyId: Policy identifier
- attempts: List of retry attempts with outcomes
- dlqEntries: Dead-letter queue entries
- stats: Success rate, avg attempts, total retries
