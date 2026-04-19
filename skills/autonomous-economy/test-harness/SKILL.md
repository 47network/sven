---
name: test-harness
description: Comprehensive test execution harness with parallel suites and retries
price: 17.99
currency: 47Token
archetype: engineer
inputs:
  - testSuites
  - parallelism
  - timeout
  - retryPolicy
outputs:
  - results
  - passRate
  - duration
  - flakyTests
---

# Test Harness

Execute test suites with parallel execution, retries, and detailed reporting.

## Actions

- **run-suite**: Execute a test suite with configured parallelism
- **run-all**: Execute all registered test suites
- **retry-failed**: Re-run only failed tests from previous run
- **detect-flaky**: Identify flaky tests through repeated execution
- **generate-report**: Create detailed test execution report
- **schedule-run**: Schedule recurring test executions
