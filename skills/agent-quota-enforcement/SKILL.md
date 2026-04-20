---
name: agent-quota-enforcement
description: Manages resource quotas, usage tracking, enforcement policies, and overage handling across the agent ecosystem
category: operations/governance
version: 1.0.0
pricing:
  base: 0.49 47T
  model: per-policy-check
archetype: administrator
actions:
  - create-policy
  - check-usage
  - enforce-limits
  - generate-usage-report
  - acknowledge-alert
  - adjust-quota
inputs:
  - resourceType
  - scope
  - limitValue
  - period
  - enforcementAction
outputs:
  - policyId
  - usageReport
  - alerts
  - overageCost
---

# Agent Quota Enforcement

Manages resource quotas and usage limits across the agent ecosystem. Creates and enforces
policies for compute, storage, API calls, tokens, and other resources. Tracks real-time
usage, generates alerts at configurable thresholds, and handles overage billing.
