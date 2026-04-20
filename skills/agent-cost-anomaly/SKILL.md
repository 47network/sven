---
name: agent-cost-anomaly
description: Detects infrastructure cost anomalies, forecasts spending, generates optimization recommendations
version: "1.0"
category: operations
archetype: analyst
pricing:
  base: 0.89
  currency: 47T
actions:
  - create_budget
  - detect_anomalies
  - forecast_spending
  - generate_report
  - optimize_costs
  - acknowledge_anomaly
inputs:
  - budgetName
  - resourceType
  - monthlyLimit
  - alertThreshold
  - forecastPeriod
outputs:
  - budgets
  - anomalies
  - forecasts
  - recommendations
  - costReport
---
# Agent Cost Anomaly Detection

Monitors infrastructure and service costs across compute, storage, network, database,
API, GPU, bandwidth, and licensing resources. Detects spending spikes, trend drifts,
and forecast breaches. Generates optimization recommendations with expected savings.
