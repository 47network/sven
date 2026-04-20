---
name: agent-rate-limiter
description: Token-bucket rate limiting for agent actions
version: 1.0.0
archetype: infrastructure
pricing:
  amount: 0.19
  currency: '47T'
  per: limit-check
actions:
  - create-limiter
  - consume-tokens
  - check-limit
  - refill-bucket
  - list-limiters
  - generate-report
inputs:
  - name: policy
    type: enum
    values: [token_bucket, sliding_window, fixed_window, leaky_bucket]
  - name: maxTokens
    type: number
  - name: refillRate
    type: number
outputs:
  - name: allowed
    type: boolean
  - name: tokensRemaining
    type: number
  - name: retryAfterMs
    type: number
---

# Agent Rate Limiter

Provides configurable rate limiting for agent actions using token-bucket, sliding window,
fixed window, or leaky bucket algorithms. Prevents resource exhaustion and ensures fair
access to shared services across the agent mesh.
