---
name: agent-capacity-forecasting
version: 1.0.0
description: Predict resource demand and capacity needs using time-series forecasting
triggers:
  - capacity_create_model
  - capacity_train_model
  - capacity_generate_forecast
  - capacity_check_alerts
  - capacity_get_recommendations
  - capacity_report
pricing:
  model: per_forecast
  base: 2.00
archetype: analyst
---
# Capacity Forecasting Skill
Predicts future resource capacity needs using time-series models. Generates alerts for threshold breaches and exhaustion predictions.
