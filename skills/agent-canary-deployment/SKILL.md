---
skill: agent-canary-deployment
version: 1.0.0
triggers:
  - canary_create_release
  - canary_adjust_traffic
  - canary_promote
  - canary_rollback
  - canary_add_trigger
  - canary_report
intents:
  - manage canary releases with traffic splitting
  - configure automated rollback triggers
  - promote or roll back canary versions
outputs:
  - release creation and status updates
  - traffic adjustment confirmations
  - promotion/rollback outcomes
  - canary vs baseline metric comparisons
---
# Agent Canary Deployment
Orchestrates canary releases with progressive traffic shifting, automated rollback triggers on error rate/latency/resource spikes, and baseline-vs-canary metric comparison.
