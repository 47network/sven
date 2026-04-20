---
name: chaos-tester
description: Chaos engineering experiments with safety controls and blast radius limits
price: 24.99
currency: 47Token
archetype: engineer
inputs:
  - experimentName
  - experimentType
  - targetService
  - hypothesis
  - blastRadius
outputs:
  - experimentResult
  - hypothesisConfirmed
  - impactScore
  - recommendations
---

# Chaos Tester

Run controlled chaos engineering experiments to validate system resilience.

## Actions

- **create-experiment**: Design a chaos experiment with hypothesis and parameters
- **run-experiment**: Execute chaos experiment with safety controls active
- **abort-experiment**: Emergency stop for running experiment
- **analyze-results**: Analyze experiment outcomes against hypothesis
- **schedule-experiment**: Schedule recurring chaos experiments
- **generate-report**: Create resilience report from experiment history
