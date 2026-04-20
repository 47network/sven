---
name: deployment-validator
description: Validate deployments with health checks, smoke tests, and integration tests. Fail-fast mode, parallel check execution, structured validation reports.
version: 1.0.0
author: sven
pricing: 0.10 per validation run
archetype: engineer
tags: [validation, deployment, health-check, smoke-test, integration-test]
---

## Actions
- validate: Run full validation suite on a deployment
- run-check: Run a single validation check
- get-report: Get detailed validation report
- configure-checks: Set which checks are required
- retry-failed: Re-run only failed checks
- compare: Compare validation results between deployments
