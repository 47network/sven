---
name: outage-predictor
description: Predictive outage analysis using metrics correlation, pattern recognition, and ML forecasting
version: 1.0.0
price: 12.99
currency: 47Token
archetype: analyst
---

## Actions
- predict: Analyze current signals for outage probability
- correlate: Find correlations between metrics preceding past outages
- train: Update prediction model with recent incident data
- evaluate: Assess prediction accuracy against actual outcomes

## Inputs
- predictionWindow: How far ahead to predict (1h, 6h, 24h)
- dataSources: metrics, logs, events, traces
- confidenceThreshold: Minimum confidence for alerting
- services: Services to monitor

## Outputs
- predictions: List of predicted outages with confidence scores
- riskScore: Overall system risk score (0-100)
- correlations: Metric correlations indicating risk
- recommendedActions: Preventive measures to take
