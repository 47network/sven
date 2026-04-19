---
name: contract-tester
description: API contract testing between provider and consumer services
price: 16.99
currency: 47Token
archetype: engineer
inputs:
  - providerService
  - consumerService
  - contractSpec
  - testFramework
outputs:
  - testResults
  - breakingChanges
  - compatibilityScore
  - report
---

# Contract Tester

Verify API contracts between services to prevent breaking changes.

## Actions

- **create-contract**: Define a contract between provider and consumer
- **verify-contract**: Run contract verification tests
- **detect-breaking**: Analyze changes for breaking contract violations
- **compatibility-check**: Check backward/forward compatibility
- **generate-stubs**: Generate provider stubs from consumer contracts
- **contract-report**: Generate compatibility report across all contracts
