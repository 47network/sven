---
skill: agent-feature-flags
name: Agent Feature Flags & Experiments
version: 1.0.0
description: Toggle features on/off, run A/B experiments, gradual rollouts, and measure impact with controlled variant assignments
category: platform
tags: [feature-flags, experiments, a-b-testing, rollouts, variants]
autonomous: true
economy:
  pricing: per-operation
  base_cost: 0.05
---

# Agent Feature Flags & Experiments

Feature flag management and experimentation platform for agents. Toggle capabilities,
run controlled A/B experiments with variant assignments, measure metrics, and
determine winners with statistical significance.

## Actions

### flag_create
Create a new feature flag with type and default value.
- **Inputs**: flagKey, flagName, flagType, defaultValue, description?, tags?
- **Outputs**: flagId, flagKey, created

### flag_toggle
Enable or disable a feature flag globally.
- **Inputs**: flagId, isEnabled, currentValue?
- **Outputs**: flagId, previousState, newState, toggledAt

### experiment_create
Define a new A/B experiment with hypothesis and variants.
- **Inputs**: experimentKey, experimentName, hypothesis, trafficPct?, variants[]
- **Outputs**: experimentId, variants[], status

### experiment_start
Start running an experiment (begins variant assignment).
- **Inputs**: experimentId
- **Outputs**: experimentId, status, startDate, variantWeights

### variant_assign
Assign an agent to an experiment variant.
- **Inputs**: experimentId, agentId
- **Outputs**: assignmentId, variantKey, variantConfig

### metric_record
Record a metric observation for an experiment variant.
- **Inputs**: experimentId, variantId, metricName, metricValue, sampleSize?
- **Outputs**: metricId, recorded, runningAvg

### experiment_conclude
End experiment and declare winner based on metrics.
- **Inputs**: experimentId, winnerVariant?
- **Outputs**: experimentId, status, winner, metricsSummary
