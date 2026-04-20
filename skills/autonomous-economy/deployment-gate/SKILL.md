---
name: deployment-gate
description: Pre-deployment quality gates with automated and manual approval workflows
price: 13.99
currency: 47Token
archetype: engineer
inputs:
  - deploymentId
  - checkType
  - checkParameters
  - approvalRequired
outputs:
  - checkResult
  - gateDecision
  - approvalStatus
  - blockingReasons
---

# Deployment Gate

Enforce quality gates before deployments with configurable check pipelines.

## Actions

- **configure-checks**: Set up required pre-deployment checks
- **run-checks**: Execute all configured checks for a deployment
- **request-approval**: Request manual approval from designated approvers
- **gate-status**: View current gate status and blocking checks
- **override-gate**: Admin override for blocked deployments with reason
- **audit-decisions**: View history of gate decisions and overrides
