---
name: agent-capacity-planning
version: 1.0.0
archetype: analyst
price: 1.49 47T
status: active
---
# Agent Capacity Planning
Forecast resource needs, plan scaling, and track utilization trends.
## Actions
| Action | Description |
|--------|-------------|
| create-model | Create a capacity model for a resource type |
| run-forecast | Generate capacity forecast for a resource |
| propose-action | Propose a scaling/provisioning action |
| utilization-report | Generate utilization trend report |
| breach-alerts | Check for upcoming capacity breaches |
| approve-action | Approve a proposed capacity action |
## Inputs
- `resourceType` — Resource to model (compute, memory, storage, gpu, network, agents, tasks)
- `forecastMethod` — Forecast algorithm (linear, exponential, seasonal, ml_based, manual)
- `thresholdPct` — Alert threshold percentage (default 80)
- `maxCapacity` — Maximum capacity for the resource
## Outputs
- `modelId` — Created model identifier
- `forecast` — Predicted usage with confidence intervals
- `breachExpected` — Whether capacity breach is expected
- `proposedActions` — Recommended scaling actions
- `utilizationTrend` — Historical utilization data
