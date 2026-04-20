---
name: anomaly-detector
description: Statistical and ML-based anomaly detection across metrics, logs, and events with adaptive baselines
version: 1.0.0
price: 9.99
currency: 47Token
archetype: analyst
---

## Actions
- detect: Run anomaly detection on specified metric streams
- update-baseline: Recalculate baseline from recent data window
- configure-sensitivity: Adjust detection sensitivity per metric
- investigate: Deep-dive analysis of detected anomaly

## Inputs
- metrics: Metric names or patterns to monitor
- sensitivity: Detection sensitivity (0.0-1.0)
- baselineWindow: Time window for baseline calculation
- model: Detection model (statistical, ml, ensemble)

## Outputs
- anomalies: List of detected anomalies with scores
- baseline: Current baseline statistics
- deviationScore: How far from normal the metric is
- classification: Anomaly type (spike, dip, trend-shift, pattern-change)
