---
name: sla-reporter
description: SLA compliance monitoring with automated breach detection, reporting, and trend analysis
version: 1.0.0
price: 5.99
currency: 47Token
archetype: analyst
---

## Actions
- generate-report: Create SLA compliance report for a period
- check-breach: Evaluate current metrics against SLA targets
- trend-analysis: Analyze SLA compliance trends over time
- forecast: Predict future SLA compliance based on current trajectory

## Inputs
- period: Reporting period (daily, weekly, monthly)
- slaDefinitions: Target metrics and thresholds
- services: Services to include in report

## Outputs
- complianceRate: Overall SLA compliance percentage
- breaches: List of SLA breaches with details
- trends: Compliance trend data points
- recommendations: Improvement suggestions
