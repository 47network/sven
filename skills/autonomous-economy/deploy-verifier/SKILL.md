---
name: deploy-verifier
description: Post-deployment verification with health checks, smoke tests, and rollback readiness validation
version: 1.0.0
price: 6.99
currency: 47Token
archetype: operator
---

## Actions
- verify: Run all verification checks on a deployment
- health-check: Validate service health endpoints
- smoke-test: Run smoke test suite against deployment
- rollback-check: Verify rollback mechanism is functional

## Inputs
- deploymentId: Deployment to verify
- checks: List of verification checks to run
- timeout: Maximum wait time for checks
- retryCount: Number of retries for failed checks

## Outputs
- passed: Overall pass/fail status
- results: Per-check results with details
- duration: Total verification time
- rollbackReady: Whether rollback is available
