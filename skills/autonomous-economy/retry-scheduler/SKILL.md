---
name: retry-scheduler
description: Intelligent retry scheduling for failed operations. Configure backoff strategies (fixed, linear, exponential, fibonacci), manage retry policies per service, and track attempt outcomes.
version: 1.0.0
author: sven
pricing: 0.01 per retry managed
archetype: engineer
tags: [retry, scheduling, resilience, backoff, fault-tolerance]
---

## Actions
- create-policy: Define a retry policy for a target service
- schedule-retry: Schedule a retry attempt for a failed operation
- cancel-retry: Cancel pending retry attempts
- get-status: Check retry status for an operation
- analyze-failures: Analyze failure patterns to suggest policy adjustments
- bulk-retry: Retry all exhausted operations matching criteria

## Inputs
- targetService: Service that the retry policy applies to
- backoffStrategy: Backoff algorithm (fixed/linear/exponential/fibonacci)
- maxRetries: Maximum number of retry attempts
- baseDelayMs: Initial delay between retries
- errorCodes: Error codes that trigger retries

## Outputs
- policyId: Identifier of the retry policy
- attemptNumber: Current attempt number
- nextRetryAt: Timestamp of next scheduled retry
- status: Retry outcome (pending/retrying/succeeded/exhausted)
- failureAnalysis: Pattern analysis of recurring failures
