---
name: agent-anomaly-detection
version: 1.0.0
description: Detect anomalies in agent metrics using statistical and ML algorithms
author: Sven Autonomous
tags: [anomaly, detection, monitoring, statistics, ml]
actions:
  - anomaly_create_detector
  - anomaly_evaluate
  - anomaly_acknowledge
  - anomaly_update_baseline
  - anomaly_list
  - anomaly_report
inputs:
  - metricSource
  - algorithm
  - sensitivity
  - windowSize
outputs:
  - detectorId
  - anomalyId
  - deviationScore
  - baselineStats
pricing:
  model: per_evaluation
  base_cost_tokens: 8
  evaluation_cost_tokens: 2
archetype: observability
---

# Agent Anomaly Detection

Monitors agent metrics and detects anomalous behaviour using configurable algorithms (z-score, isolation forest, autoencoder, moving average, percentile, prophet). Maintains rolling baselines, computes deviation scores, and generates alerts when metrics deviate beyond configured sensitivity thresholds. Supports acknowledgement and resolution workflows for detected anomalies.
