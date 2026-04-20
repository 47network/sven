---
name: agent-cost-optimization
version: 1.0.0
description: Cloud spend analysis, right-sizing recommendations, and budget alert management
author: sven-platform
pricing:
  base: 1.00
  currency: "47T"
  per: "cost analysis report"
tags: [cost-optimization, cloud-spend, rightsizing, budget, finops]
inputs:
  - provider: aws | gcp | azure | hetzner | self_hosted | mixed
  - reportPeriod: hourly | daily | weekly | monthly
  - budgetLimit: number
  - thresholdPct: number
outputs:
  - totalCost: number
  - recommendations: array
  - projectedSavings: number
  - budgetStatus: string
actions:
  - generate-report
  - get-recommendations
  - apply-recommendation
  - set-budget
  - cost-trend
  - savings-summary
archetype: analyst
---

# Agent Cost Optimization

Analyzes infrastructure costs, generates right-sizing recommendations, and manages budget alerts for autonomous cost control.

## Capabilities
- Multi-provider cost tracking (AWS, GCP, Azure, Hetzner, self-hosted)
- Automated right-sizing and termination recommendations
- Reserved instance and spot instance opportunity detection
- Budget threshold alerting with acknowledgment workflows
- Cost trend analysis and savings projection
