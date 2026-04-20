---
name: test-orchestrator
description: Automated test suite orchestration and coverage tracking
version: 1.0.0
price: 13.99
currency: USD
archetype: analyst
tags: [testing, quality, coverage, automation]
---
# Test Orchestrator
Parallel test execution, failure tracking, and coverage reporting.
## Actions
### run-suite
Execute a test suite with parallel workers.
- **inputs**: suiteName, framework, parallel, coverageEnabled
- **outputs**: totalTests, passed, failed, skipped, coveragePercent
### analyze-failures
Analyze test failures and suggest fixes.
- **inputs**: runId, autoRetry
- **outputs**: failures[], patterns, suggestedFixes
### track-coverage
Track code coverage trends over time.
- **inputs**: configId, since, threshold
- **outputs**: coverageTrend[], currentPercent, belowThreshold
### configure-tests
Set up test orchestrator configuration.
- **inputs**: framework, testDirectory, parallelWorkers, coverageThreshold
- **outputs**: configId, framework
### retry-failed
Retry all failed tests from a run.
- **inputs**: runId, maxRetries
- **outputs**: retried, newPassed, stillFailing
### export-report
Export test results report.
- **inputs**: runId, format, includeStackTraces
- **outputs**: report, totalTests, passRate
