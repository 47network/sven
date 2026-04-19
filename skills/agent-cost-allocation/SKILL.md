---
name: agent-cost-allocation
version: 1.0.0
archetype: analyst
price: 0.29 47T
status: active
---

# Agent Cost Allocation

Track, allocate, and optimize infrastructure costs across agents, crews, and projects.

## Actions

| Action | Description |
|--------|-------------|
| create-center | Create a new cost center (agent, crew, project, service) |
| record-cost | Record a cost entry against a cost center |
| generate-report | Generate cost allocation report for a period |
| budget-check | Check budget utilization for a cost center |
| cost-forecast | Forecast future costs based on historical trends |
| optimize-spend | Identify cost optimization opportunities |

## Inputs

- `centerType` — Cost center type (agent, crew, project, department, service, infrastructure)
- `entryType` — Cost category (compute, storage, network, api_call, model_inference, bandwidth, license)
- `budgetLimit` — Optional budget cap
- `budgetPeriod` — Budget period (daily, weekly, monthly, quarterly, yearly)
- `reportPeriod` — Period for cost report

## Outputs

- `centerId` — Created cost center ID
- `totalCost` — Total cost for period
- `budgetUsedPct` — Budget utilization percentage
- `recommendations` — Cost optimization suggestions
- `forecast` — Projected future costs
